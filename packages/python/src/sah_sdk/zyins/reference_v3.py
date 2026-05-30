"""``isa.zyins.reference`` — typed reference catalog access (Python).

Mirror of ``packages/ts/src/zyins/reference.ts`` (PEP 8 snake_case
naming). The reference namespace gives consumers a :class:`Concept`
handle for any medication, condition, or unknown free-text term.
Symmetric accessors (``concept.conditions(sort)`` /
``concept.medications(sort)``) walk the v3 id-keyed maps
``medications_by_condition`` and ``frequency_graphs.use_map`` directly —
no client-side key normalization, no client-side sorting heuristics.

Load-bearing invariants (these are why the namespace exists):

  - :func:`_make_key` is INTERNAL. It is never exported on the public
    surface; consumers never compute keys themselves. The conformance
    corpus pokes at it via the explicit ``_internal`` escape hatch.
  - The public matcher API never raises. Unknown text returns a handle
    with ``is_known=False``, accessors return ``()``, and ``input_text``
    preserves the original string. Unknowns are not errors — they are
    signals to the server.
  - Lookups use the server's id-keyed maps. The SDK does not
    re-derive keys.

The :class:`Sort` enum is namespaced — ``Sort.MOST_COMMON_FIRST`` /
``Sort.ALPHABETICAL``. No ``Sort.Asc`` / ``Sort.Desc``, no closures,
no string aliases. New sort orders ship as new enum members.
"""

from __future__ import annotations

from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass, field
from enum import Enum

from .datasets_v3 import DatasetBundleV3


class Sort(str, Enum):
    """Sort orders for the symmetric accessors on a :class:`Concept`."""

    MOST_COMMON_FIRST = "most_common_first"
    ALPHABETICAL = "alphabetical"


class ConceptKind(str, Enum):
    """Discriminator on a :class:`Concept` handle."""

    MEDICATION = "medication"
    CONDITION = "condition"
    UNKNOWN = "unknown"


# ---------------------------------------------------------------------------
# Internal — _make_key normalizer.
#
# Mirrors Go's ``MakeKey`` in ``go/zyins/models/makekey.go`` and the TS
# ``makeKey`` helper: uppercase the string, then strip every character
# that is not ASCII alphanumeric.
# "High Blood Pressure" → "HIGHBLOODPRESSURE".
#
# This function is NOT exported. The reference namespace is the only
# code path that calls it; consumers must use :func:`match_medication`,
# :func:`match_condition`, :func:`match_concept`, or the bound matchers
# on a :class:`ReferenceService`.
# ---------------------------------------------------------------------------


def _make_key(text: str) -> str:
    upper = text.upper()
    chars: list[str] = []
    for ch in upper:
        code = ord(ch)
        is_digit = 0x30 <= code <= 0x39
        is_upper = 0x41 <= code <= 0x5A
        if is_digit or is_upper:
            chars.append(ch)
    return "".join(chars)


# ---------------------------------------------------------------------------
# Catalog facade — a thin read-only view over a v3 DatasetBundleV3.
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class _Catalog:
    condition_names: Mapping[str, str]
    medication_names: Mapping[str, str]
    medications_by_condition: Mapping[str, Sequence[str]]
    conditions_by_medication: Mapping[str, Sequence[str]]
    use_map: Mapping[str, Mapping[str, int]]

    def condition_name(self, entity_id: str) -> str | None:
        return self.condition_names.get(entity_id)

    def medication_name(self, entity_id: str) -> str | None:
        return self.medication_names.get(entity_id)

    def medications_for_condition(self, condition_id: str) -> Sequence[str]:
        return self.medications_by_condition.get(condition_id, ())

    def conditions_for_medication(self, medication_id: str) -> Sequence[str]:
        return self.conditions_by_medication.get(medication_id, ())

    def frequency(self, medication_id: str, condition_id: str) -> int:
        row = self.use_map.get(condition_id)
        if row is None:
            return 0
        return row.get(medication_id, 0)


def _build_catalog(bundle: DatasetBundleV3) -> _Catalog:
    conditions_by_medication: dict[str, list[str]] = {}
    for condition_id, med_ids in bundle.medications_by_condition.items():
        for med_id in med_ids:
            conditions_by_medication.setdefault(med_id, []).append(condition_id)

    condition_names = {e.id: e.name for e in bundle.conditions}
    medication_names = {e.id: e.name for e in bundle.medications}

    return _Catalog(
        condition_names=condition_names,
        medication_names=medication_names,
        medications_by_condition=bundle.medications_by_condition,
        conditions_by_medication={
            k: tuple(v) for k, v in conditions_by_medication.items()
        },
        use_map=bundle.frequency_graphs.use_map,
    )


# Catalog is rebuilt per matcher invocation.
#
# An earlier draft cached on ``id(bundle)`` — a global ``dict[int,
# _Catalog]`` indexed by the Python object id. That cache had two
# defects that surfaced in review:
#   1) Memory leak: bundles never released their cache entry, since
#      Python does not notify us when an id becomes free.
#   2) Stale lookups: once a bundle was garbage-collected, CPython
#      could reuse the same id for a freshly-allocated bundle and the
#      cache would hand back the previous catalog.
#
# ``DatasetBundleV3`` uses ``@dataclass(frozen=True, slots=True)`` and
# embeds mappings, so it is neither hashable nor (pre-3.11)
# weakref-able. Rather than fight the type system, we rebuild the
# catalog on each :func:`match_*` call. Catalog construction is O(N)
# over the bundle's entity lists; the cost is dominated by the
# dictionary iteration the caller would do anyway, and a single
# match() call is not on a hot loop in any real consumer.
def _catalog_for(bundle: DatasetBundleV3) -> _Catalog:
    return _build_catalog(bundle)


# ---------------------------------------------------------------------------
# Concept handle. Construction is private — consumers always receive a
# handle from a matcher.
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class Concept:
    """Handle returned by the matchers. Never raises on unknown text.

    ``id`` is opaque (today: server-side ``MakeKey`` form); ``name`` is
    the display string; ``input_text`` preserves the caller's raw input
    verbatim. For unknown handles ``id`` is ``None`` and ``is_known`` is
    ``False``; ``name`` falls back to ``input_text`` so a UI always has
    something to render.
    """

    id: str | None
    name: str
    kind: ConceptKind
    is_known: bool
    input_text: str
    _catalog: _Catalog | None = field(default=None, repr=False, compare=False)

    def conditions(
        self, sort: Sort = Sort.MOST_COMMON_FIRST
    ) -> Sequence[Concept]:
        """Conditions associated with this concept.

        Defined for medication handles; condition / unknown handles
        return an empty tuple. Sort defaults to
        :attr:`Sort.MOST_COMMON_FIRST`.
        """
        if (
            self.kind is not ConceptKind.MEDICATION
            or self._catalog is None
            or self.id is None
        ):
            return ()
        catalog = self._catalog
        med_id = self.id
        condition_ids = catalog.conditions_for_medication(med_id)
        if sort is Sort.ALPHABETICAL:
            ordered = _sort_by_name(condition_ids, catalog.condition_name)
        else:
            ordered = _sort_by_frequency(
                condition_ids,
                lambda cid: catalog.frequency(med_id, cid),
            )
        return tuple(
            _build_condition_concept(catalog, cid, self.input_text) for cid in ordered
        )

    def medications(
        self, sort: Sort = Sort.MOST_COMMON_FIRST
    ) -> Sequence[Concept]:
        """Medications associated with this concept.

        Defined for condition handles; medication / unknown handles
        return an empty tuple. Sort defaults to
        :attr:`Sort.MOST_COMMON_FIRST`.
        """
        if (
            self.kind is not ConceptKind.CONDITION
            or self._catalog is None
            or self.id is None
        ):
            return ()
        catalog = self._catalog
        condition_id = self.id
        med_ids = catalog.medications_for_condition(condition_id)
        if sort is Sort.ALPHABETICAL:
            ordered = _sort_by_name(med_ids, catalog.medication_name)
        else:
            ordered = _sort_by_frequency(
                med_ids,
                lambda mid: catalog.frequency(mid, condition_id),
            )
        return tuple(
            _build_medication_concept(catalog, mid, self.input_text) for mid in ordered
        )


def _sort_by_frequency(
    ids: Sequence[str], frequency_of: Callable[[str], int]
) -> Sequence[str]:
    # Stable: ties preserve input order (the server's display order).
    indexed = list(enumerate(ids))
    indexed.sort(key=lambda pair: (-frequency_of(pair[1]), pair[0]))
    return tuple(pair[1] for pair in indexed)


def _sort_by_name(
    ids: Sequence[str], name_of: Callable[[str], str | None]
) -> Sequence[str]:
    indexed = list(enumerate(ids))
    indexed.sort(key=lambda pair: (name_of(pair[1]) or pair[1], pair[0]))
    return tuple(pair[1] for pair in indexed)


def _build_medication_concept(
    catalog: _Catalog, entity_id: str, input_text: str
) -> Concept:
    return Concept(
        id=entity_id,
        name=catalog.medication_name(entity_id) or input_text,
        kind=ConceptKind.MEDICATION,
        is_known=True,
        input_text=input_text,
        _catalog=catalog,
    )


def _build_condition_concept(
    catalog: _Catalog, entity_id: str, input_text: str
) -> Concept:
    return Concept(
        id=entity_id,
        name=catalog.condition_name(entity_id) or input_text,
        kind=ConceptKind.CONDITION,
        is_known=True,
        input_text=input_text,
        _catalog=catalog,
    )


def _build_unknown_concept(input_text: str) -> Concept:
    return Concept(
        id=None,
        name=input_text,
        kind=ConceptKind.UNKNOWN,
        is_known=False,
        input_text=input_text,
        _catalog=None,
    )


# ---------------------------------------------------------------------------
# Public match entry points — module-level functions and the bound
# :class:`ReferenceService` namespace returned by the SDK client.
# ---------------------------------------------------------------------------


def match_medication(text: str, bundle: DatasetBundleV3) -> Concept:
    """Resolve free text against the medication catalog. Never raises."""
    catalog = _catalog_for(bundle)
    key = _make_key(text)
    if key and catalog.medication_name(key) is not None:
        return _build_medication_concept(catalog, key, text)
    return _build_unknown_concept(text)


def match_condition(text: str, bundle: DatasetBundleV3) -> Concept:
    """Resolve free text against the condition catalog. Never raises."""
    catalog = _catalog_for(bundle)
    key = _make_key(text)
    if key and catalog.condition_name(key) is not None:
        return _build_condition_concept(catalog, key, text)
    return _build_unknown_concept(text)


def match_concept(text: str, bundle: DatasetBundleV3) -> Concept:
    """Resolve free text without specifying a kind.

    Tries conditions first (the typical "the user typed a symptom"
    case), then medications. Returns an unknown handle on a miss.
    Never raises.
    """
    catalog = _catalog_for(bundle)
    key = _make_key(text)
    if not key:
        return _build_unknown_concept(text)
    if catalog.condition_name(key) is not None:
        return _build_condition_concept(catalog, key, text)
    if catalog.medication_name(key) is not None:
        return _build_medication_concept(catalog, key, text)
    return _build_unknown_concept(text)


@dataclass(frozen=True, slots=True)
class BundleBoundMatcher:
    """Callable matcher bound to a specific :class:`DatasetBundleV3`."""

    _bundle: DatasetBundleV3
    _resolver: Callable[[str, DatasetBundleV3], Concept]

    def match(self, text: str) -> Concept:
        return self._resolver(text, self._bundle)


@dataclass(frozen=True, slots=True)
class ReferenceService:
    """``isa.zyins.reference`` — typed catalog access bound to one bundle.

    Built by :func:`make_reference_service` once a
    :class:`DatasetBundleV3` is in hand; exposes
    ``service.medications.match(text)``,
    ``service.conditions.match(text)`` and
    ``service.concepts.match(text)``.
    """

    medications: BundleBoundMatcher
    conditions: BundleBoundMatcher
    concepts: BundleBoundMatcher


def make_reference_service(bundle: DatasetBundleV3) -> ReferenceService:
    """Build a :class:`ReferenceService` bound to ``bundle``."""
    return ReferenceService(
        medications=BundleBoundMatcher(bundle, match_medication),
        conditions=BundleBoundMatcher(bundle, match_condition),
        concepts=BundleBoundMatcher(bundle, match_concept),
    )


# ---------------------------------------------------------------------------
# Testing hook — exposed so the conformance corpus can assert that the
# internal normalizer matches the server-side ``MakeKey``. Not part of
# the public consumer surface; intentionally omitted from ``__all__``.
# ---------------------------------------------------------------------------


class _Internal:
    """Conformance escape hatch. Not part of the public surface."""

    make_key = staticmethod(_make_key)


_internal = _Internal()


__all__ = [
    "BundleBoundMatcher",
    "Concept",
    "ConceptKind",
    "ReferenceService",
    "Sort",
    "make_reference_service",
    "match_concept",
    "match_condition",
    "match_medication",
]
