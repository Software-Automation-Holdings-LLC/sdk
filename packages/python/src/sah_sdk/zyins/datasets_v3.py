"""``GET /v3/datasets`` — the typed, id-keyed reference catalog (Python).

Mirror of ``packages/ts/src/zyins/datasets-v3.ts``.

Why this exists alongside :mod:`sah_sdk.zyins.datasets`:

  The v2 ``/v2/reference-data`` endpoint returns conditions whose
  medications are nested inside each condition row. The SDK rebuilt
  the relationship maps client-side and used raw condition names as
  keys — which caused the live "Show options renders nothing /
  Most-Common sorts alphabetically" bug (consumers look up by
  ``make_key``, the SDK keyed by raw name → empty result).

  ``/v3/datasets`` ships the id-keyed maps server-side, so the SDK
  passes them through verbatim. Zero client-side derivation. Zero
  client-side normalization. The shape IS the contract.

  This is the canonical datasets surface for the SDK going forward.
  The legacy :mod:`sah_sdk.zyins.datasets` module remains for any
  caller still on ``/v2/reference-data`` but the SDK's public facade
  routes here.
"""

from __future__ import annotations

import json
import math
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from enum import Enum
from types import MappingProxyType
from typing import Literal

from ..core.errors import from_http_response
from ..core.transport import Transport


class DatasetCategory(str, Enum):
    """Closed enum of dataset categories the server returns.

    ``SPELLING_CORRECTIONS`` is the canonical category name on the new
    inline-row /v3/datasets shape (kind-prefixed ULID ``spl_…``);
    ``CORRECTIONS`` is retained as an alias for the pre-cutover wire
    shape and resolves to the same bundle field.
    """

    MEDICATIONS = "medications"
    CONDITIONS = "conditions"
    PRODUCTS = "products"
    CORRECTIONS = "corrections"
    NICOTINE_OPTIONS = "nicotine_options"
    SPELLING_CORRECTIONS = "spelling_corrections"


@dataclass(frozen=True, slots=True)
class ReferenceEntity:
    """One reference catalog entity (medication, condition, product, …).

    ``id`` is the opaque entity identifier — under the inline-row
    /v3/datasets shape it is a kind-prefixed ULID (``cond_…``,
    ``med_…``, ``nic_…``, ``spl_…``); under the legacy maps-shape it
    equalled the server-side ``MakeKey`` form. Either way, ``name`` is
    the display string. Aliases are resolved server-side and
    intentionally NOT surfaced — consumers compare on ``id``.
    """

    id: str
    name: str


@dataclass(frozen=True, slots=True)
class ConditionRow:
    """One row of ``datasets.conditions.items`` on the inline-row shape.

    ``treated_with`` is the pre-joined list of medications used to
    treat this condition, sorted descending by ``prescription_count``
    server-side (ties alphabetical). The SDK passes the order through
    verbatim — no client-side re-sort.
    """

    id: str
    name: str
    treated_with: Sequence[MedicationRelation] = field(default_factory=tuple)


@dataclass(frozen=True, slots=True)
class MedicationRow:
    """One row of ``datasets.medications.items`` on the inline-row shape.

    ``used_for`` is the pre-joined list of conditions this medication
    treats, sorted descending by ``prescription_count``.
    """

    id: str
    name: str
    used_for: Sequence[ConditionRelation] = field(default_factory=tuple)


@dataclass(frozen=True, slots=True)
class MedicationRelation:
    """Element of :attr:`ConditionRow.treated_with`."""

    id: str
    name: str
    prescription_count: int


@dataclass(frozen=True, slots=True)
class ConditionRelation:
    """Element of :attr:`MedicationRow.used_for`."""

    id: str
    name: str
    prescription_count: int


@dataclass(frozen=True, slots=True)
class NicotineOptionRow:
    """One row of ``datasets.nicotine_options.items``."""

    id: str
    name: str
    type: str  # "smoked" | "smokeless"


@dataclass(frozen=True, slots=True)
class SpellingCorrectionRow:
    """One row of ``datasets.spelling_corrections.items``.

    ``from_`` is the misspelled token (suffix-underscored because
    ``from`` is a Python keyword); ``to`` is the canonical form.
    """

    id: str
    from_: str
    to: str


@dataclass(frozen=True, slots=True)
class DatasetEntry:
    """Per-dataset version + row count + items.

    ``items`` is empty in ``fields=meta`` responses; the SDK
    normalizes that absence to an empty tuple so consumers do not
    branch on ``None``.
    """

    version: str
    item_count: int
    items: Sequence[ReferenceEntity] = field(default_factory=tuple)


@dataclass(frozen=True, slots=True)
class FrequencyGraphs:
    """Prescription-frequency graphs keyed by entity id.

    ``use_map`` is a ``condition_id → { medication_id → integer
    frequency }`` table. Sort a condition's medications by descending
    frequency to render "Most Common" order.
    """

    use_map: Mapping[str, Mapping[str, int]] = field(
        default_factory=lambda: MappingProxyType({})
    )


@dataclass(frozen=True, slots=True)
class DatasetBundleV3:
    """The v3 datasets bundle.

    Replaces the v2 ``DatasetBundle`` wherever the SDK consumes
    datasets. Notable differences from v2:

      - ``conditions`` / ``medications`` / ``products`` are typed
        :class:`ReferenceEntity` tuples, not opaque records or strings.
      - ``medications_by_condition`` is id→[id], passed through from
        the server. No client-side key normalization.
      - ``frequency_graphs`` is id-keyed integer frequencies, also
        pass-through.
    """

    version: str
    medications: Sequence[ReferenceEntity]
    conditions: Sequence[ReferenceEntity]
    products: Sequence[ReferenceEntity]
    corrections: Sequence[ReferenceEntity]
    nicotine_options: Sequence[ReferenceEntity]
    medications_by_condition: Mapping[str, Sequence[str]]
    frequency_graphs: FrequencyGraphs
    datasets: Mapping[str, DatasetEntry | None]
    etag: str | None = None
    # ------------------------------------------------------------------
    # Inline-row shape (locked /v3/datasets cutover). Each row is a
    # complete record carrying its own relations. Empty tuples when the
    # server returns the pre-cutover maps-shape; in that case consumers
    # fall back to :attr:`medications_by_condition` and
    # :attr:`frequency_graphs.use_map`.
    # ------------------------------------------------------------------
    condition_rows: Sequence[ConditionRow] = field(default_factory=tuple)
    medication_rows: Sequence[MedicationRow] = field(default_factory=tuple)
    nicotine_option_rows: Sequence[NicotineOptionRow] = field(default_factory=tuple)
    spelling_corrections: Sequence[SpellingCorrectionRow] = field(default_factory=tuple)
    # ------------------------------------------------------------------
    # Product slices — pass-through from the server. Consumers read these
    # directly rather than re-deriving family membership from flat product
    # rows. Empty when the server omits the slice.
    # ------------------------------------------------------------------
    products_by_family: Mapping[str, Sequence[ReferenceEntity]] = field(
        default_factory=lambda: MappingProxyType({})
    )
    discontinued_products: Mapping[str, int] = field(
        default_factory=lambda: MappingProxyType({})
    )
    state_derivatives: Sequence[str] = field(default_factory=tuple)


@dataclass(frozen=True, slots=True)
class DatasetsV3NotModified:
    """Result of a 304-bearing :func:`get_datasets_v3` call.

    Switch on this with :func:`is_not_modified` to keep using the
    cached bundle.
    """

    not_modified: Literal[True] = True
    etag: str | None = None


def is_not_modified(
    result: DatasetBundleV3 | DatasetsV3NotModified,
) -> bool:
    """Discriminator helper. ``True`` iff the server returned 304."""
    return isinstance(result, DatasetsV3NotModified)


@dataclass(frozen=True, slots=True)
class DatasetsV3GetOptions:
    """Options accepted by :func:`get_datasets_v3`."""

    include: Sequence[DatasetCategory] | None = None
    fields: Literal["full", "meta"] | None = None
    if_none_match: str | None = None


_DATASETS_V3_PATH = "/v3/datasets"

# Discontinued-product epochs are int64 unix seconds on the wire. Python ints
# are unbounded, so an out-of-range epoch would be silently kept here while the
# Go/C#/PHP int64-typed parsers reject it. Gate on the same int64 window so all
# five SDKs drop an out-of-range epoch identically.
_INT64_MIN = -(2**63)
_INT64_MAX = 2**63 - 1


# ---------------------------------------------------------------------------
# Transport entry point.
# ---------------------------------------------------------------------------


def get_datasets_v3(
    options: DatasetsV3GetOptions | None,
    *,
    transport: Transport,
    base_url: str,
    headers: Mapping[str, str],
) -> DatasetBundleV3 | DatasetsV3NotModified:
    """Issue ``GET /v3/datasets`` and parse the envelope.

    The caller supplies the signed auth headers (license HMAC or
    bearer token) plus an injectable :class:`Transport` so the
    function is fully testable without httpx.

    On 304 returns a :class:`DatasetsV3NotModified` sentinel with the
    response ETag (if any). On 2xx returns a parsed
    :class:`DatasetBundleV3`. Non-2xx, non-304 raises a typed
    :class:`~sah_sdk.core.errors.ISAError` built by
    :func:`from_http_response`.
    """
    path_with_query = _path_with_query(options)
    request_headers: dict[str, str] = dict(headers)
    if options is not None and options.if_none_match is not None:
        request_headers["If-None-Match"] = options.if_none_match

    response = transport.request(
        "GET", f"{base_url}{path_with_query}", headers=request_headers
    )
    if response.status == 304:
        return DatasetsV3NotModified(etag=_read_etag(response.headers))
    if response.status < 200 or response.status >= 300:
        raise from_http_response(
            response.status,
            response.body,
            request_id=response.request_id(),
            retry_after_seconds=_retry_after_seconds(response.headers),
        )
    return parse_datasets_v3_envelope(response.body, etag=_read_etag(response.headers))


def _retry_after_seconds(headers: Mapping[str, str]) -> float | None:
    """Read ``Retry-After`` as seconds; ``None`` when missing or HTTP-date.

    See :func:`sah_sdk.zyins.prequalify_v3._retry_after_seconds` —
    same semantics, duplicated here to avoid a module-level import
    cycle between the v3 modules.
    """
    for header_name, header_value in headers.items():
        if header_name.lower() == "retry-after":
            try:
                return float(header_value)
            except (TypeError, ValueError):
                return None
    return None


def _path_with_query(options: DatasetsV3GetOptions | None) -> str:
    if options is None:
        return _DATASETS_V3_PATH
    parts: list[str] = []
    if options.include is not None:
        # ``include=`` (empty value) is the documented "meta-only"
        # shortcut on the server; preserve that semantics if the
        # caller passes an explicit empty sequence.
        parts.append("include=" + ",".join(cat.value for cat in options.include))
    if options.fields is not None:
        parts.append(f"fields={options.fields}")
    if not parts:
        return _DATASETS_V3_PATH
    return f"{_DATASETS_V3_PATH}?{'&'.join(parts)}"


def _read_etag(headers: Mapping[str, str]) -> str | None:
    for key, value in headers.items():
        if key.lower() == "etag":
            return value
    return None


# ---------------------------------------------------------------------------
# Parsing — defensive but never lossy.
# ---------------------------------------------------------------------------


def parse_datasets_v3_envelope(body: str, *, etag: str | None = None) -> DatasetBundleV3:
    """Parse a ``/v3/datasets`` envelope body into a :class:`DatasetBundleV3`.

    Exposed for tests and for callers that want to drive the parser
    against captured response bodies without an HTTP round trip.
    Raises :class:`ValueError` only when ``body`` is not valid JSON;
    every other shape mismatch defaults to empty tuples and zero
    counts so downstream consumers never branch on ``None``.
    """
    try:
        parsed = json.loads(body)
    except json.JSONDecodeError as exc:
        raise ValueError(
            f"Invalid JSON response from {_DATASETS_V3_PATH}: {exc.msg}"
        ) from exc
    root: Mapping[str, object] = parsed if isinstance(parsed, dict) else {}
    data_raw = root.get("data")
    data: Mapping[str, object] = data_raw if isinstance(data_raw, dict) else {}
    return _parse_data(data, etag=etag)


def _parse_data(data: Mapping[str, object], *, etag: str | None) -> DatasetBundleV3:
    datasets_field = data.get("datasets")
    datasets_obj: Mapping[str, object] = (
        datasets_field if isinstance(datasets_field, dict) else {}
    )
    # Parse inline-row shape lazily — each helper handles the absence
    # of the section gracefully.
    condition_rows = _parse_condition_rows(datasets_obj.get("conditions"))
    medication_rows = _parse_medication_rows(datasets_obj.get("medications"))
    nicotine_option_rows = _parse_nicotine_option_rows(datasets_obj.get("nicotine_options"))
    spelling_corrections = _parse_spelling_correction_rows(
        datasets_obj.get("spelling_corrections")
    )

    datasets: dict[str, DatasetEntry | None] = {
        DatasetCategory.MEDICATIONS.value: _parse_dataset_entry(datasets_obj.get("medications")),
        DatasetCategory.CONDITIONS.value: _parse_dataset_entry(datasets_obj.get("conditions")),
        DatasetCategory.PRODUCTS.value: _parse_dataset_entry(datasets_obj.get("products")),
        DatasetCategory.CORRECTIONS.value: _parse_dataset_entry(datasets_obj.get("corrections")),
        DatasetCategory.NICOTINE_OPTIONS.value: _parse_dataset_entry(
            datasets_obj.get("nicotine_options")
        ),
        DatasetCategory.SPELLING_CORRECTIONS.value: _parse_dataset_entry(
            datasets_obj.get("spelling_corrections")
        ),
    }

    def items_or_empty(category: DatasetCategory) -> Sequence[ReferenceEntity]:
        entry = datasets[category.value]
        return entry.items if entry is not None else ()

    version_raw = data.get("version") or data.get("catalog_version")
    version = version_raw if isinstance(version_raw, str) else ""

    # Derive the legacy maps from inline rows when the wire payload
    # uses the new shape; fall back to the explicit map fields when
    # the server still ships maps. The inline rows win when both are
    # present (post-cutover the maps are gone).
    medications_by_condition: Mapping[str, Sequence[str]]
    frequency_graphs: FrequencyGraphs
    # Inline-row data wins when rows carry relation fields, even empty
    # lists. Legacy maps-shape rows are bare {id, name}; their maps live
    # at the data root.
    has_inline_relations = _has_relation_field(
        datasets_obj.get("conditions"), "treated_with"
    ) or _has_relation_field(
        datasets_obj.get("medications"), "used_for"
    )
    if has_inline_relations:
        # Derive the legacy condition->medication maps from BOTH directions:
        # condition rows' ``treated_with`` AND medication rows' ``used_for``.
        # Asymmetric payloads (only one side populated) would otherwise drop
        # the cross-links legacy consumers rely on.
        medications_by_condition, frequency_graphs = _derive_legacy_maps(
            condition_rows, medication_rows
        )
    else:
        medications_by_condition = _parse_id_map(data.get("medications_by_condition"))
        frequency_graphs = _parse_frequency_graphs(data.get("frequency_graphs"))

    # Surface spelling corrections both as inline rows AND as the
    # legacy ``corrections`` ReferenceEntity tuple so downstream code
    # paths that haven't migrated still see them.
    if spelling_corrections and not items_or_empty(DatasetCategory.CORRECTIONS):
        corrections_entities: Sequence[ReferenceEntity] = tuple(
            ReferenceEntity(id=row.from_, name=row.to) for row in spelling_corrections
        )
    else:
        corrections_entities = items_or_empty(DatasetCategory.CORRECTIONS)

    return DatasetBundleV3(
        etag=etag,
        version=version,
        medications=items_or_empty(DatasetCategory.MEDICATIONS),
        conditions=items_or_empty(DatasetCategory.CONDITIONS),
        products=items_or_empty(DatasetCategory.PRODUCTS),
        corrections=corrections_entities,
        nicotine_options=items_or_empty(DatasetCategory.NICOTINE_OPTIONS),
        medications_by_condition=medications_by_condition,
        frequency_graphs=frequency_graphs,
        datasets=MappingProxyType(datasets),
        condition_rows=condition_rows,
        medication_rows=medication_rows,
        nicotine_option_rows=nicotine_option_rows,
        spelling_corrections=spelling_corrections,
        products_by_family=_parse_products_by_family(data.get("products_by_family")),
        discontinued_products=_parse_discontinued_products(
            data.get("discontinued_products")
        ),
        state_derivatives=_parse_state_derivatives(data.get("state_derivatives")),
    )


def _parse_products_by_family(raw: object) -> Mapping[str, Sequence[ReferenceEntity]]:
    if not isinstance(raw, dict):
        return MappingProxyType({})
    out: dict[str, Sequence[ReferenceEntity]] = {}
    for family, value in raw.items():
        if not isinstance(family, str) or not isinstance(value, list):
            continue
        entities: list[ReferenceEntity] = []
        for item in value:
            if not isinstance(item, dict):
                continue
            entity_id = item.get("id")
            name = item.get("name")
            # A row is valid iff it carries a non-empty ``id`` — the opaque
            # contract key. ``name`` is display enrichment the server may
            # legitimately leave blank or absent, so a missing/non-string name
            # defaults to "" and keeps the row. Matches the Go/TypeScript/PHP/C#
            # mirrors exactly; only a row with no id is dropped.
            if isinstance(entity_id, str) and entity_id != "":
                entities.append(
                    ReferenceEntity(
                        id=entity_id,
                        name=name if isinstance(name, str) else "",
                    )
                )
        out[family] = tuple(entities)
    return MappingProxyType(out)


def _parse_discontinued_products(raw: object) -> Mapping[str, int]:
    if not isinstance(raw, dict):
        return MappingProxyType({})
    out: dict[str, int] = {}
    for slug, value in raw.items():
        if not isinstance(slug, str):
            continue
        epoch = _integer_epoch(value)
        if epoch is not None:
            out[slug] = epoch
    return MappingProxyType(out)


def _integer_epoch(value: object) -> int | None:
    """Coerce a discontinued-product value to an integer unix-epoch second.

    Accepts integer-valued numbers in any JSON notation (1700000000,
    1700000000.0, 1.7e9) and rejects genuine fractionals (1700000000.5),
    booleans, strings, and None. Returns the epoch as an int, or None when
    the value is not a valid integer epoch. Mirrors the Go/C#/TS/PHP epoch
    parsers, which all keep integer-valued floats and drop fractionals.

    Out-of-range guard: the epoch is an int64 on the wire. An integer (or
    integer-valued float) outside the int64 window is rejected so the
    int64-typed Go/C#/PHP parsers and this unbounded-int parser agree on the
    same drop, rather than this one silently keeping a value the others cannot.
    """
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value if _INT64_MIN <= value <= _INT64_MAX else None
    if isinstance(value, float) and value.is_integer():
        coerced = int(value)
        return coerced if _INT64_MIN <= coerced <= _INT64_MAX else None
    return None


def _parse_state_derivatives(raw: object) -> Sequence[str]:
    if not isinstance(raw, list):
        return ()
    return tuple(item for item in raw if isinstance(item, str))


def _parse_condition_rows(raw: object) -> Sequence[ConditionRow]:
    items = _items_list(raw)
    out: list[ConditionRow] = []
    for entry in items:
        if not isinstance(entry, dict):
            continue
        eid = entry.get("id")
        name = entry.get("name")
        if not isinstance(eid, str) or not isinstance(name, str):
            continue
        rels_raw = entry.get("treated_with") or ()
        rels: list[MedicationRelation] = []
        if isinstance(rels_raw, list):
            for rel in rels_raw:
                if not isinstance(rel, dict):
                    continue
                rid = rel.get("id")
                rname = rel.get("name")
                rcount = rel.get("prescription_count")
                if (
                    isinstance(rid, str)
                    and isinstance(rname, str)
                    and isinstance(rcount, int)
                    and not isinstance(rcount, bool)
                ):
                    rels.append(
                        MedicationRelation(id=rid, name=rname, prescription_count=rcount)
                    )
        out.append(ConditionRow(id=eid, name=name, treated_with=tuple(rels)))
    return tuple(out)


def _parse_medication_rows(raw: object) -> Sequence[MedicationRow]:
    items = _items_list(raw)
    out: list[MedicationRow] = []
    for entry in items:
        if not isinstance(entry, dict):
            continue
        eid = entry.get("id")
        name = entry.get("name")
        if not isinstance(eid, str) or not isinstance(name, str):
            continue
        rels_raw = entry.get("used_for") or ()
        rels: list[ConditionRelation] = []
        if isinstance(rels_raw, list):
            for rel in rels_raw:
                if not isinstance(rel, dict):
                    continue
                rid = rel.get("id")
                rname = rel.get("name")
                rcount = rel.get("prescription_count")
                if (
                    isinstance(rid, str)
                    and isinstance(rname, str)
                    and isinstance(rcount, int)
                    and not isinstance(rcount, bool)
                ):
                    rels.append(
                        ConditionRelation(id=rid, name=rname, prescription_count=rcount)
                    )
        out.append(MedicationRow(id=eid, name=name, used_for=tuple(rels)))
    return tuple(out)


def _parse_nicotine_option_rows(raw: object) -> Sequence[NicotineOptionRow]:
    items = _items_list(raw)
    out: list[NicotineOptionRow] = []
    for entry in items:
        if not isinstance(entry, dict):
            continue
        eid = entry.get("id")
        name = entry.get("name")
        ntype = entry.get("type")
        if isinstance(eid, str) and isinstance(name, str) and isinstance(ntype, str):
            out.append(NicotineOptionRow(id=eid, name=name, type=ntype))
    return tuple(out)


def _parse_spelling_correction_rows(raw: object) -> Sequence[SpellingCorrectionRow]:
    items = _items_list(raw)
    out: list[SpellingCorrectionRow] = []
    for entry in items:
        if not isinstance(entry, dict):
            continue
        eid = entry.get("id")
        src = entry.get("from")
        dst = entry.get("to")
        if isinstance(eid, str) and isinstance(src, str) and isinstance(dst, str):
            out.append(SpellingCorrectionRow(id=eid, from_=src, to=dst))
    return tuple(out)


def _items_list(raw: object) -> list[object]:
    if not isinstance(raw, dict):
        return []
    items = raw.get("items")
    return items if isinstance(items, list) else []


def _has_relation_field(raw: object, field: str) -> bool:
    return any(isinstance(entry, dict) and field in entry for entry in _items_list(raw))


def _derive_legacy_maps(
    condition_rows: Sequence[ConditionRow],
    medication_rows: Sequence[MedicationRow],
) -> tuple[Mapping[str, Sequence[str]], FrequencyGraphs]:
    """Build the legacy condition->medication maps from inline rows.

    Merges both relation directions so asymmetric payloads keep their
    cross-links: condition rows contribute their ``treated_with`` medications
    and medication rows contribute the conditions they are ``used_for``. When
    both sides describe the same pair the condition-side prescription count
    wins (it is encountered first); medication-side counts fill gaps.
    """
    use_map: dict[str, dict[str, int]] = {}

    def record(condition_id: str, medication_id: str, count: int) -> None:
        meds = use_map.setdefault(condition_id, {})
        meds.setdefault(medication_id, count)

    for cond in condition_rows:
        use_map.setdefault(cond.id, {})
        for med_rel in cond.treated_with:
            record(cond.id, med_rel.id, med_rel.prescription_count)
    for med in medication_rows:
        for cond_rel in med.used_for:
            record(cond_rel.id, med.id, cond_rel.prescription_count)

    medications_by_condition = MappingProxyType(
        {cid: tuple(meds.keys()) for cid, meds in use_map.items()}
    )
    frequency_graphs = FrequencyGraphs(
        use_map=MappingProxyType(
            {cid: MappingProxyType(dict(meds)) for cid, meds in use_map.items()}
        )
    )
    return medications_by_condition, frequency_graphs


def _parse_dataset_entry(raw: object) -> DatasetEntry | None:
    if not isinstance(raw, dict):
        return None
    raw_obj: Mapping[str, object] = raw
    items_raw = raw_obj.get("items")
    items_seq = items_raw if isinstance(items_raw, list) else []
    items: list[ReferenceEntity] = []
    for entry in items_seq:
        if not isinstance(entry, dict):
            continue
        entity_id = entry.get("id")
        # ``name`` is the canonical display field; spelling-correction
        # rows ship a ``from`` field instead, which we surface as the
        # display name on the legacy ReferenceEntity tuple.
        display = entry.get("name")
        if not isinstance(display, str):
            from_field = entry.get("from")
            if isinstance(from_field, str):
                display = from_field
        if isinstance(entity_id, str) and isinstance(display, str):
            items.append(ReferenceEntity(id=entity_id, name=display))
    version_raw = raw_obj.get("version")
    item_count_raw = raw_obj.get("item_count")
    return DatasetEntry(
        version=version_raw if isinstance(version_raw, str) else "",
        item_count=int(item_count_raw)
        if isinstance(item_count_raw, int) and not isinstance(item_count_raw, bool)
        else len(items),
        items=tuple(items),
    )


def _parse_id_map(raw: object) -> Mapping[str, Sequence[str]]:
    if not isinstance(raw, dict):
        return MappingProxyType({})
    out: dict[str, Sequence[str]] = {}
    for key, value in raw.items():
        if not isinstance(value, list):
            continue
        ids = tuple(v for v in value if isinstance(v, str))
        out[key] = ids
    return MappingProxyType(out)


def _parse_frequency_graphs(raw: object) -> FrequencyGraphs:
    if not isinstance(raw, dict):
        return FrequencyGraphs(use_map=MappingProxyType({}))
    use_map_raw = raw.get("use_map")
    if not isinstance(use_map_raw, dict):
        return FrequencyGraphs(use_map=MappingProxyType({}))
    use_map: dict[str, Mapping[str, int]] = {}
    for condition_id, row_raw in use_map_raw.items():
        if not isinstance(row_raw, dict):
            continue
        row: dict[str, int] = {}
        for med_id, freq_raw in row_raw.items():
            # JSON numbers come back as int or float; reject bools,
            # NaN/Inf, and non-integral floats. Integer frequencies
            # only (contract: integer prescription counts). A float
            # whose value is not exactly representable as an integer
            # is wire corruption — drop it rather than silently
            # truncate.
            if isinstance(freq_raw, bool):
                continue
            if isinstance(freq_raw, int):
                row[med_id] = freq_raw
                continue
            if not isinstance(freq_raw, float):
                continue
            if not math.isfinite(freq_raw):
                continue
            if not freq_raw.is_integer():
                continue
            row[med_id] = int(freq_raw)
        use_map[condition_id] = MappingProxyType(row)
    return FrequencyGraphs(use_map=MappingProxyType(use_map))


__all__ = [
    "ConditionRelation",
    "ConditionRow",
    "DatasetBundleV3",
    "DatasetCategory",
    "DatasetEntry",
    "DatasetsV3GetOptions",
    "DatasetsV3NotModified",
    "FrequencyGraphs",
    "MedicationRelation",
    "MedicationRow",
    "NicotineOptionRow",
    "ReferenceEntity",
    "SpellingCorrectionRow",
    "get_datasets_v3",
    "is_not_modified",
    "parse_datasets_v3_envelope",
]
