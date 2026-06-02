#!/usr/bin/env python3
"""Generate the Python catalog modules under ``src/sah_sdk/catalog/``.

Reads the same source data the TS generator (``packages/ts/scripts/gen-catalog.mjs``)
uses and emits idiomatic Python with frozen dataclasses + str-Enums. Output is
byte-stable for identical input bytes.

Sources:
    - ``insurance/v2_products.json``    → Products + ProductCarriers
    - ``insurance/v2_medications.json`` → MedicationUses
    - ``isa-platform/shared/schemas/api/isa/v1/common.proto`` → Scope, ErrorCode
    - ``isa-platform/shared/go/events/registry.go``           → SignEvent

Override discovery via ``SDK_PLATFORM_REPO`` / ``SDK_INSURANCE_REPO`` env vars.
"""

from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path
from typing import Any

REPO_PY = Path(__file__).resolve().parent.parent
CATALOG_DIR = REPO_PY / "src" / "sah_sdk" / "catalog"


def _resolve_platform_repo() -> Path:
    override = os.environ.get("SDK_PLATFORM_REPO")
    if override:
        return Path(override).resolve()
    candidates = [
        (REPO_PY / ".." / "..").resolve(),
    ]
    for p in candidates:
        if (p / "shared" / "schemas").exists():
            return p
    return candidates[0]


def _resolve_insurance_repo(platform_repo: Path) -> Path:
    override = os.environ.get("SDK_INSURANCE_REPO")
    if override:
        return Path(override).resolve()
    candidates = [
        (platform_repo / ".." / "insurance").resolve(),
    ]
    for p in candidates:
        if p.exists():
            return p
    return candidates[0]


PLATFORM_REPO = _resolve_platform_repo()
INSURANCE_REPO = _resolve_insurance_repo(PLATFORM_REPO)

GAPS: list[str] = []


def _header(sources: list[str]) -> str:
    src_lines = "\n".join(f"#   - {s}" for s in sources)
    return (
        '"""Generated catalog module — do not hand-edit; rerun the generator.\n\n'
        "Produced by ``packages/python/scripts/gen_catalog.py``.\n"
        "Regenerate with ``python packages/python/scripts/gen_catalog.py``.\n"
        '"""\n'
        f"# Source data:\n{src_lines}\n"
        "from __future__ import annotations\n\n"
    )


def _try_read_json(path: Path) -> Any:
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:  # pragma: no cover
        sys.stderr.write(f"gen_catalog: failed to read {path}: {exc}\n")
        return None


def _try_read_text(path: Path) -> str | None:
    if not path.exists():
        return None
    try:
        return path.read_text(encoding="utf-8")
    except OSError as exc:  # pragma: no cover
        sys.stderr.write(f"gen_catalog: failed to read {path}: {exc}\n")
        return None


def _pascal(value: str) -> str:
    parts = re.sub(r"[^a-zA-Z0-9]+", " ", value).strip().split()
    return "".join(p[:1].upper() + p[1:].lower() for p in parts)


def _screaming_snake(value: str) -> str:
    """Build a valid PEP-8 enum member name from an arbitrary string."""
    cleaned = re.sub(r"[^a-zA-Z0-9]+", "_", value).strip("_")
    if not cleaned:
        return "UNNAMED"
    if cleaned[0].isdigit():
        cleaned = "_" + cleaned
    return cleaned.upper()


def _slugify(value: str) -> str:
    return re.sub(r"^-+|-+$", "", re.sub(r"[^a-z0-9]+", "-", value.lower()))


def _write_file(name: str, content: str) -> None:
    CATALOG_DIR.mkdir(parents=True, exist_ok=True)
    out = CATALOG_DIR / name
    out.write_text(content, encoding="utf-8")
    sys.stderr.write(f"gen_catalog: wrote {out}\n")


def _preserve_or_fail(names: list[str], label: str) -> None:
    """Handle a missing product data source without ever shipping an empty catalog.

    The product catalog is the SDK's headline surface (``Products.Fex.AetnaAccendo``
    etc.); shipping it empty is a launch-blocking defect (isa-sdk@1.0.1). The
    upstream ``v2_products.json`` lives in the engine repo, which CI runners do
    not check out — so a clean CI build legitimately misses it. In that case the
    committed catalog is the source of truth: it carries the real ``prod_<uuid>``
    ids, so preserve it untouched rather than clobbering it with an empty stub.

    When NO committed catalog exists (a genuinely fresh tree with nothing to
    preserve) emitting empty would let a broken catalog reach a registry, so
    fail loud instead — the build must regenerate from data or be run where the
    committed catalog is present.
    """
    missing = [n for n in names if not (CATALOG_DIR / n).exists()]
    if missing:
        raise SystemExit(
            f"gen_catalog: {label}: v2_products.json not found AND no committed "
            f"catalog to preserve ({', '.join(missing)}). Refusing to emit an empty "
            f"product catalog. Run where {INSURANCE_REPO / 'v2_products.json'} exists, "
            f"or commit a populated catalog first."
        )
    GAPS.append(f"{label}: v2_products.json not found — preserving committed catalog.")
    for name in names:
        sys.stderr.write(f"gen_catalog: preserved committed {CATALOG_DIR / name}\n")


# ---------------------------------------------------------------------------
# Products + Carriers
# ---------------------------------------------------------------------------


def gen_products() -> None:
    sources = ["insurance/v2_products.json"]
    raw = _try_read_json(INSURANCE_REPO / "v2_products.json")
    if not raw:
        _preserve_or_fail(["products.py", "carriers.py"], "Products")
        return

    # Family name → PascalCase namespace key (mirrors TS productsByType.ts).
    _FAMILY_NAMESPACE: dict[str, str] = {
        "fex": "Fex",
        "medsup": "Medsup",
        "preneed": "Preneed",
        "term": "Term",
    }

    # Collect per-family product rows; fail loud when any entry lacks an id.
    by_family: dict[str, list[dict[str, Any]]] = {}
    all_products: list[dict[str, Any]] = []
    for family_key, items in raw.items():
        if not isinstance(items, list):
            continue
        for p in items:
            if not isinstance(p, dict):
                continue
            raw_id = p.get("id")
            if not raw_id:
                raise ValueError(
                    f"gen_catalog: product entry missing 'id': {p!r}"
                )
            ident = str(p.get("identifier") or "")
            if not ident:
                continue
            ns = _FAMILY_NAMESPACE.get(family_key, _pascal(family_key))
            # Strip the family prefix from the slug so `Products.Fex.AetnaAccendo`
            # reads naturally — the namespace already carries the family name.
            strip_prefix = family_key + "-"
            attr_slug = ident[len(strip_prefix):] if ident.startswith(strip_prefix) else ident
            row = {
                "id": f"prod_{raw_id}",
                "slug": ident,
                "family": family_key,
                "namespace": ns,
                "carrier_display": str(p.get("carrier") or ""),
                "carrier_slug": _slugify(str(p.get("carrier") or "")),
                "display_name": str(p.get("name") or ""),
                "attr_name": _pascal(attr_slug),
            }
            by_family.setdefault(family_key, []).append(row)
            all_products.append(row)

    # Stable sort within each family for byte-stable output.
    for rows in by_family.values():
        rows.sort(key=lambda r: r["slug"])
    all_products.sort(key=lambda r: r["id"])

    # Emit one frozen constant per product inside its family class.
    family_blocks: list[str] = []
    for family_key in sorted(by_family.keys()):
        ns = _FAMILY_NAMESPACE.get(family_key, _pascal(family_key))
        rows = by_family[family_key]
        member_lines = "\n".join(
            f"    {r['attr_name']}: Product = Product("
            f"id={r['id']!r}, name={r['display_name']!r}, "
            f"product_class={r['family']!r}, carrier={r['carrier_display']!r})"
            for r in rows
        )
        family_blocks.append(
            f"class _{ns}Products:\n"
            f"    __slots__ = ()\n\n"
            f"{member_lines}\n"
        )

    family_block_text = "\n\n".join(family_blocks)

    # Frozen id→Product index built from family-class attributes.
    index_entries = "\n".join(
        f"    {r['id']!r}: _{r['namespace']}Products.{r['attr_name']},"
        for r in all_products
    )

    # _ProductsAPI attribute declarations (no __slots__ — class-level family attrs).
    family_keys_sorted = sorted(by_family.keys())
    family_attrs = "\n".join(
        f"    {_FAMILY_NAMESPACE.get(fk, _pascal(fk))}: _{_FAMILY_NAMESPACE.get(fk, _pascal(fk))}Products"
        f" = _{_FAMILY_NAMESPACE.get(fk, _pascal(fk))}Products()"
        for fk in family_keys_sorted
    )

    body = f'''{_header(sources)}from dataclasses import dataclass
from types import MappingProxyType


@dataclass(frozen=True, slots=True)
class Product:
    """A catalog product carrying its stable opaque id.

    ``id`` (``prod_<uuid>``) is the identity key: the v3 prequalify
    ``products[]`` filter, the ``by_id`` handle, and the wire value.
    ``name``, ``product_class``, and ``carrier`` are display-time metadata;
    they may change when a carrier renames a product but ``id`` stays stable.

    Never construct directly — use :data:`Products`.Fex.AetnaAccendo etc.
    """

    id: str
    name: str
    product_class: str
    carrier: str


{family_block_text}

_BY_ID: MappingProxyType[str, Product] = MappingProxyType({{
{index_entries}
}})


class _ProductsAPI:
    """Nested product catalog with ``by_id`` reverse lookup.

    Access products as ``Products.Fex.AetnaAccendo`` etc.
    Use ``Products.by_id(id)`` to resolve a ``prod_<uuid>`` back to its
    constant — the only supported lookup key. There is no ``by_slug``; slug
    is display-time metadata, not an identity key.
    """

{family_attrs}

    def by_id(self, product_id: str) -> Product | None:
        """Return the :class:`Product` for a ``prod_<uuid>`` id, or ``None``."""
        return _BY_ID.get(product_id)

    def all(self) -> tuple[Product, ...]:
        """All products in catalog order (sorted by id)."""
        return tuple(_BY_ID.values())


Products = _ProductsAPI()

__all__ = ["Product", "Products"]
'''
    _write_file("products.py", body)

    # Carriers — reference per-family product class attributes directly.
    by_carrier: dict[str, dict[str, Any]] = {}
    for p in all_products:
        entry = by_carrier.setdefault(
            p["carrier_slug"],
            {
                "slug": p["carrier_slug"],
                "display_name": p["carrier_display"],
                "products": [],
            },
        )
        entry["products"].append((p["namespace"], p["attr_name"]))
    carriers = sorted(by_carrier.values(), key=lambda c: c["slug"])

    carrier_entries = "\n".join(
        f"    {c['slug']!r}: ProductCarrierMetadata("
        f"display_name={c['display_name']!r}, "
        f"products=({', '.join(f'_{ns}Products.{attr}' for ns, attr in c['products'])},), "
        f"states=()),"
        for c in carriers
    )
    all_carriers_tuple = (
        "(" + ", ".join(f"{c['slug']!r}" for c in carriers) + (",)" if len(carriers) == 1 else ")")
    )

    # Import every family class used in this file.
    used_namespaces = sorted(
        {_FAMILY_NAMESPACE.get(fk, _pascal(fk)) for fk in by_family}
    )
    ns_imports = ", ".join(f"_{ns}Products" for ns in used_namespaces)

    carriers_module = f'''{_header(sources)}from dataclasses import dataclass

from .products import Product, {ns_imports}


@dataclass(frozen=True, slots=True)
class ProductCarrierMetadata:
    """Public metadata for a single carrier."""

    display_name: str
    products: tuple[Product, ...]
    #: ISO 2-letter state codes the carrier is licensed in. Empty today.
    states: tuple[str, ...]


_CARRIERS: dict[str, ProductCarrierMetadata] = {{
{carrier_entries}
}}

_ALL_CARRIERS: tuple[str, ...] = {all_carriers_tuple}


class _ProductCarriersAPI:
    """Catalog API for carriers."""

    __slots__ = ()

    def values(self) -> tuple[str, ...]:
        return _ALL_CARRIERS

    def metadata(self, c: str) -> ProductCarrierMetadata:
        m = _CARRIERS.get(c)
        if m is None:
            raise KeyError(f"ProductCarriers.metadata: unknown carrier {{c!r}}")
        return m


ProductCarriers = _ProductCarriersAPI()
'''
    _write_file("carriers.py", carriers_module)


# ---------------------------------------------------------------------------
# States
# ---------------------------------------------------------------------------

_STATES: list[tuple[str, str, bool]] = [
    ("Alabama", "AL", False), ("Alaska", "AK", False), ("Arizona", "AZ", False),
    ("Arkansas", "AR", False), ("California", "CA", False), ("Colorado", "CO", False),
    ("Connecticut", "CT", False), ("Delaware", "DE", False), ("Florida", "FL", False),
    ("Georgia", "GA", False), ("Hawaii", "HI", False), ("Idaho", "ID", False),
    ("Illinois", "IL", False), ("Indiana", "IN", False), ("Iowa", "IA", False),
    ("Kansas", "KS", False), ("Kentucky", "KY", False), ("Louisiana", "LA", False),
    ("Maine", "ME", False), ("Maryland", "MD", False), ("Massachusetts", "MA", False),
    ("Michigan", "MI", False), ("Minnesota", "MN", False), ("Mississippi", "MS", False),
    ("Missouri", "MO", False), ("Montana", "MT", False), ("Nebraska", "NE", False),
    ("Nevada", "NV", False), ("New Hampshire", "NH", False), ("New Jersey", "NJ", False),
    ("New Mexico", "NM", False), ("New York", "NY", False), ("North Carolina", "NC", False),
    ("North Dakota", "ND", False), ("Ohio", "OH", False), ("Oklahoma", "OK", False),
    ("Oregon", "OR", False), ("Pennsylvania", "PA", False), ("Rhode Island", "RI", False),
    ("South Carolina", "SC", False), ("South Dakota", "SD", False), ("Tennessee", "TN", False),
    ("Texas", "TX", False), ("Utah", "UT", False), ("Vermont", "VT", False),
    ("Virginia", "VA", False), ("Washington", "WA", False), ("West Virginia", "WV", False),
    ("Wisconsin", "WI", False), ("Wyoming", "WY", False),
    ("District of Columbia", "DC", False),
    ("American Samoa", "AS", True), ("Guam", "GU", True),
    ("Northern Mariana Islands", "MP", True), ("Puerto Rico", "PR", True),
    ("United States Virgin Islands", "VI", True),
]


def gen_states() -> None:
    sources = ["ISO 3166-2:US (50 states + DC + 5 inhabited territories)"]
    enum_lines = "\n".join(f"    {_pascal(name)} = {abbr!r}" for name, abbr, _ in _STATES)
    meta_lines = "\n".join(
        f"    {abbr!r}: StateMetadata(abbreviation={abbr!r}, name={name!r}, is_territory={is_terr}),"
        for name, abbr, is_terr in _STATES
    )
    by_name_lines = "\n".join(
        f"    {name.lower()!r}: {abbr!r}," for name, abbr, _ in _STATES
    )
    module = f'''{_header(sources)}from dataclasses import dataclass
from enum import Enum


class State(str, Enum):
    """ISO 3166-2:US administrative subdivisions.

    Includes the 50 states, DC, and the five inhabited US territories.
    Order is alphabetical by name.
    """

{enum_lines}


@dataclass(frozen=True, slots=True)
class StateMetadata:
    abbreviation: str
    name: str
    is_territory: bool


_METADATA: dict[str, StateMetadata] = {{
{meta_lines}
}}

_BY_NAME: dict[str, str] = {{
{by_name_lines}
}}

_ALL_STATES: tuple[State, ...] = tuple(State)


class _StatesAPI:
    __slots__ = ()

    def values(self) -> tuple[State, ...]:
        return _ALL_STATES

    def entries(self) -> tuple[tuple[State, StateMetadata], ...]:
        return tuple((s, _METADATA[s.value]) for s in _ALL_STATES)

    def metadata(self, s: State) -> StateMetadata:
        m = _METADATA.get(s.value)
        if m is None:
            raise KeyError(f"States.metadata: unknown state {{s!r}}")
        return m

    def by_abbreviation(self, abbr: str) -> State | None:
        """Look up a state by ISO abbreviation or full English name.

        Both forms are case-insensitive. Returns ``None`` for unknown input.
        """
        if not isinstance(abbr, str) or not abbr:
            return None
        upper = abbr.upper()
        if upper in _METADATA:
            return State(upper)
        from_name = _BY_NAME.get(abbr.lower())
        return State(from_name) if from_name else None


States = _StatesAPI()
'''
    _write_file("states.py", module)


# ---------------------------------------------------------------------------
# Conditions + MedicationUses
# ---------------------------------------------------------------------------


def gen_conditions_and_medications() -> None:
    sources = ["insurance/v2_conditions.json", "insurance/v2_medications.json"]
    meds_raw = _try_read_json(INSURANCE_REPO / "v2_medications.json")

    GAPS.append(
        "ConditionCategories: source data (v2_conditions.json) does not expose taxonomic categories. Emitting empty catalog."
    )
    cond_module = f'''{_header(sources)}from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class ConditionCategoryMetadata:
    """Categories partition the canonical condition list into clinical groups.

    The engine's reference data does not currently expose a stable category
    taxonomy; this catalog is intentionally empty until the upstream
    publishes one. The shape is fixed so consumers can code against it today.
    """

    display_name: str
    conditions: tuple[str, ...]


_CATEGORIES: dict[str, ConditionCategoryMetadata] = {{}}
_ALL_CATEGORIES: tuple[str, ...] = ()


class _ConditionCategoriesAPI:
    __slots__ = ()

    def values(self) -> tuple[str, ...]:
        return _ALL_CATEGORIES

    def metadata(self, c: str) -> ConditionCategoryMetadata:
        m = _CATEGORIES.get(c)
        if m is None:
            raise KeyError(f"ConditionCategories.metadata: unknown category {{c!r}}")
        return m


ConditionCategories = _ConditionCategoriesAPI()
'''
    _write_file("conditions.py", cond_module)

    use_to_meds: dict[str, set[str]] = {}
    if isinstance(meds_raw, list):
        for m in meds_raw:
            if not isinstance(m, dict):
                continue
            name = str(m.get("name") or "")
            uses = m.get("uses") or []
            if not isinstance(uses, list):
                continue
            for u in uses:
                if not isinstance(u, dict):
                    continue
                cond = str(u.get("condition") or "")
                if not cond or not name:
                    continue
                use_to_meds.setdefault(cond, set()).add(name)
    else:
        GAPS.append("MedicationUses: v2_medications.json missing or malformed.")

    use_names = sorted(use_to_meds.keys())
    use_entries = "\n".join(
        f"    {u!r}: MedicationUseMetadata("
        f"display_name={u!r}, "
        f"medications=tuple({sorted(use_to_meds[u])!r})),"
        for u in use_names
    )

    meds_module = f'''{_header(sources)}from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class MedicationUseMetadata:
    """A "use" is a canonical condition name treated by at least one medication.

    The ``medications`` tuple lists every medication recorded as treating
    that use. Catalog size is large (~3000 uses; ~6000 medications); only
    the names you import are retained.
    """

    display_name: str
    medications: tuple[str, ...]


_USES: dict[str, MedicationUseMetadata] = {{
{use_entries}
}}

_ALL_USES: tuple[str, ...] = tuple(sorted(_USES.keys()))


class _MedicationUsesAPI:
    __slots__ = ()

    def values(self) -> tuple[str, ...]:
        return _ALL_USES

    def metadata(self, u: str) -> MedicationUseMetadata:
        m = _USES.get(u)
        if m is None:
            raise KeyError(f"MedicationUses.metadata: unknown use {{u!r}}")
        return m


MedicationUses = _MedicationUsesAPI()
'''
    _write_file("medications.py", meds_module)


# ---------------------------------------------------------------------------
# Scopes (parse common.proto)
# ---------------------------------------------------------------------------


def gen_scopes() -> None:
    sources = ["isa-platform/shared/schemas/api/isa/v1/common.proto"]
    text = _try_read_text(PLATFORM_REPO / "shared" / "schemas" / "api" / "isa" / "v1" / "common.proto")
    scopes: list[tuple[str, str, str]] = []  # (enum_name, wire, doc)
    if text:
        block = re.search(r"enum Scope \{([\s\S]*?)\}\s*$", text, re.MULTILINE)
        if block:
            pending = ""
            for line in block.group(1).split("\n"):
                trimmed = line.strip()
                if trimmed.startswith("//"):
                    pending += " " + re.sub(r"^//\s?", "", trimmed)
                    continue
                m = re.match(r"^(SCOPE_[A-Z0-9_]+)\s*=\s*\d+;", trimmed)
                if m:
                    symbol = m.group(1)
                    if symbol == "SCOPE_UNSPECIFIED":
                        pending = ""
                        continue
                    wire_m = re.search(r"`([^`]+)`", pending)
                    if not wire_m:
                        pending = ""
                        continue
                    wire = wire_m.group(1)
                    doc = re.sub(r"`[^`]+`\s*—?\s*", "", pending).strip()
                    enum_name = "".join(p[:1].upper() + p[1:].lower() for p in re.split(r"[:\-]", wire))
                    scopes.append((enum_name, wire, doc))
                    pending = ""
                elif trimmed == "":
                    pending = ""

    if not scopes:
        GAPS.append("Scope: failed to parse common.proto Scope enum — emitting empty catalog.")
    scopes.sort(key=lambda x: x[1])

    members = "\n".join(
        f'    """{doc}"""\n    {enum_name} = {wire!r}' if doc else f"    {enum_name} = {wire!r}"
        for enum_name, wire, doc in scopes
    )
    desc_entries = "\n".join(f"    {wire!r}: {doc!r}," for _, wire, doc in scopes)

    module = f'''{_header(sources)}from enum import Enum


class Scope(str, Enum):
    """Bearer-token scopes recognized across the ISA platform.

    Mirrors the ``api.isa.v1.Scope`` proto enum's wire-form values; new
    scopes ship here when added upstream.
    """

{members if members else "    pass"}


ScopeDescriptions: dict[str, str] = {{
{desc_entries}
}}
'''
    _write_file("scopes.py", module)


# ---------------------------------------------------------------------------
# SignEvents (parse registry.go)
# ---------------------------------------------------------------------------


def gen_sign_events() -> None:
    sources = ["isa-platform/shared/go/events/registry.go"]
    text = _try_read_text(PLATFORM_REPO / "shared" / "go" / "events" / "registry.go")
    events: list[tuple[str, str]] = []
    if text:
        for m in re.finditer(r'EventType[A-Za-z0-9]+\s+EventType\s*=\s*"([^"]+)"', text):
            wire = m.group(1)
            if not re.match(r"^(document|signer)\.", wire):
                continue
            enum_name = "".join(p[:1].upper() + p[1:].lower() for p in wire.split("."))
            events.append((enum_name, wire))

    if not events:
        GAPS.append("SignEvent: no rapidsign-domain events parsed from registry.go.")
    events.sort(key=lambda x: x[1])
    members = "\n".join(f"    {n} = {w!r}" for n, w in events)
    labels = "\n".join(f"    {w!r}: {n!r}," for n, w in events)
    module = f'''{_header(sources)}from enum import Enum


class SignEvent(str, Enum):
    """RapidSign webhook event types.

    The wire string is the EventBridge ``detail-type`` value the platform emits.
    """

{members if members else "    pass"}


SignEventLabels: dict[str, str] = {{
{labels}
}}
'''
    _write_file("sign_events.py", module)


# ---------------------------------------------------------------------------
# Errors (parse common.proto ErrorCode)
# ---------------------------------------------------------------------------

_ADVICE_MAP: dict[str, str] = {
    "validation_error": "fix_request_body",
    "idempotency_conflict": "retry_with_new_key",
    "rate_limit_exceeded": "wait_and_retry",
    "token_expired": "refresh_session",
    "invalid_token": "reissue_session",
    "license_locked": "contact_support",
    "forbidden": "check_scopes",
    "not_found": "verify_resource_id",
    "method_not_allowed": "check_http_method",
    "conflict": "reconcile_state",
    "unauthorized": "authenticate_caller",
    "internal_error": "retry_or_contact_support",
    "bad_gateway": "retry_with_backoff",
    "gateway_timeout": "retry_with_backoff",
    "service_unavailable": "retry_with_backoff",
    "not_implemented": "check_feature_availability",
}


def gen_errors() -> None:
    sources = ["isa-platform/shared/schemas/api/isa/v1/common.proto"]
    text = _try_read_text(PLATFORM_REPO / "shared" / "schemas" / "api" / "isa" / "v1" / "common.proto")
    codes: list[tuple[str, str, str]] = []
    if text:
        block = re.search(r"enum ErrorCode \{([\s\S]*?)\}", text, re.MULTILINE)
        if block:
            pending = ""
            for line in block.group(1).split("\n"):
                trimmed = line.strip()
                if trimmed.startswith("//"):
                    pending += " " + re.sub(r"^//\s?", "", trimmed)
                    continue
                m = re.match(r"^ERROR_CODE_([A-Z0-9_]+)\s*=\s*\d+;", trimmed)
                if m:
                    symbol = m.group(1)
                    if symbol == "UNSPECIFIED":
                        pending = ""
                        continue
                    wire = symbol.lower()
                    enum_name = "".join(p[:1].upper() + p[1:].lower() for p in symbol.split("_"))
                    codes.append((enum_name, wire, pending.strip()))
                    pending = ""
                elif trimmed == "":
                    pending = ""

    if not codes:
        GAPS.append("ErrorCode: failed to parse common.proto ErrorCode enum — emitting empty catalog.")
    codes.sort(key=lambda x: x[1])

    members = "\n".join(
        f'    """{doc}"""\n    {n} = {w!r}' if doc else f"    {n} = {w!r}"
        for n, w, doc in codes
    )
    advice_entries = "\n".join(
        f"    {w!r}: {_ADVICE_MAP.get(w, 'see_docs')!r}," for _, w, _ in codes
    )
    doc_entries = "\n".join(
        f"    {w!r}: 'https://docs.isaapi.com/errors/{w}'," for _, w, _ in codes
    )

    module = f'''{_header(sources)}from enum import Enum


class ErrorCode(str, Enum):
    """Stable wire-form error codes. Mirrors ``api.isa.v1.ErrorCode``.

    Consumers MUST switch on these values rather than HTTP status or
    message text.
    """

{members if members else "    pass"}


#: Machine-readable next-action identifiers keyed by wire error code.
ErrorAdviceCodes: dict[str, str] = {{
{advice_entries}
}}


#: Doc URL per error code. Every value resolves to a live remediation page.
ErrorDocUrls: dict[str, str] = {{
{doc_entries}
}}
'''
    _write_file("errors.py", module)


# ---------------------------------------------------------------------------
# Index (re-export barrel)
# ---------------------------------------------------------------------------


def gen_index() -> None:
    body = '''"""Generated catalog re-export barrel.

Produced by ``packages/python/scripts/gen_catalog.py``.
"""
from __future__ import annotations

from .carriers import ProductCarrierMetadata, ProductCarriers
from .conditions import ConditionCategories, ConditionCategoryMetadata
from .errors import ErrorAdviceCodes, ErrorCode, ErrorDocUrls
from .medications import MedicationUseMetadata, MedicationUses
from .products import Product, Products
from .scopes import Scope, ScopeDescriptions
from .sign_events import SignEvent, SignEventLabels
from .states import State, StateMetadata, States

__all__ = [
    "ConditionCategories",
    "ConditionCategoryMetadata",
    "ErrorAdviceCodes",
    "ErrorCode",
    "ErrorDocUrls",
    "MedicationUseMetadata",
    "MedicationUses",
    "Product",
    "ProductCarrierMetadata",
    "ProductCarriers",
    "Products",
    "Scope",
    "ScopeDescriptions",
    "SignEvent",
    "SignEventLabels",
    "State",
    "StateMetadata",
    "States",
]
'''
    _write_file("__init__.py", body)


def main() -> int:
    CATALOG_DIR.mkdir(parents=True, exist_ok=True)
    gen_states()
    gen_products()
    gen_conditions_and_medications()
    gen_scopes()
    gen_sign_events()
    gen_errors()
    gen_index()
    if GAPS:
        sys.stderr.write("\ngen_catalog: data-source gaps:\n")
        for g in GAPS:
            sys.stderr.write(f"  - {g}\n")
    sys.stderr.write("\ngen_catalog: done\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
