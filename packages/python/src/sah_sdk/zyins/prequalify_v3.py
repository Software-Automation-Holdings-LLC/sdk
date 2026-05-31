"""``POST /v3/prequalify`` — v3 prequalify transport + parser (Python).

Mirror of ``packages/ts/src/zyins/prequalify-v3.ts`` and
``prequalify-v3-types.ts``.

The v3 contract collapses v2's ``premium`` + ``other_offers`` split
into one uniform ``pricing[]`` table per product. Money is integer
cents plus a server-formatted ``display`` string; array order is
authoritative; there is no ``result_index``.

Idempotency: every v3 mutating call requires a UUID v4 in
``Idempotency-Key``. We auto-mint when the caller does not supply one
(via :mod:`sah_sdk.core.idempotency`).
"""

from __future__ import annotations

import json
import math
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from enum import Enum
from types import MappingProxyType
from typing import Any, Literal

from ..core.errors import from_http_response
from ..core.idempotency import generate_idempotency_key
from ..core.transport import Transport
from .applicant import (
    Applicant,
    Condition,
    Medication,
    NicotineDuration,
    NicotineProductUsage,
    NicotineUsage,
    NicotineUsageInput,
)
from .coverage import Coverage, CoverageType, QuoteType
from .product import ProductSelection

# ---------------------------------------------------------------------------
# Typed value objects.
# ---------------------------------------------------------------------------


class V3EligibilityCategory(str, Enum):
    """Underwriting rank bucket.

    Closed enum; ``None`` reserved for the unlikely case the server
    cannot resolve any bucket. This is NOT the carrier rate-class
    label — that lives on :attr:`V3PricingRow.rate_class`.
    """

    IMMEDIATE = "immediate"
    GRADED = "graded"
    ROP = "rop"
    OTHER = "other"


@dataclass(frozen=True, slots=True)
class V3Eligibility:
    """Eligibility for one row of the pricing table."""

    category: V3EligibilityCategory | None
    eligible: bool
    reasons: Sequence[str] = field(default_factory=tuple)


@dataclass(frozen=True, slots=True)
class V3Amount:
    """A money amount in integer minor units paired with a display string.

    The OpenAPI ``AmountResponse``. ``cents`` is canonical for
    arithmetic; ``display`` renders verbatim and is never parsed.
    """

    cents: int
    display: str


#: Recurrence period for a :class:`V3Money`. ``None`` is a one-time /
#: lump-sum amount (a death benefit); the named values are premium
#: billing cycles.
V3Period = Literal["monthly", "quarterly", "semiannual", "annual"]

_V3_PERIODS: frozenset[str] = frozenset({"monthly", "quarterly", "semiannual", "annual"})


@dataclass(frozen=True, slots=True)
class V3Money:
    """A money value with a recurrence period (the OpenAPI ``Money``).

    Used for ``death_benefit`` (``period=None``, a one-time lump sum)
    and ``budget`` (``period="monthly"``, the requested monthly budget).
    ``amount`` is the canonical :class:`V3Amount`; ``period``
    disambiguates one-time vs recurring.
    """

    amount: V3Amount
    period: V3Period | None


@dataclass(frozen=True, slots=True)
class V3Premium:
    """Premium for one row of the pricing table.

    ``amount`` is the headline value clients compare across carriers; it
    is byte-identical to ``modes[default_mode]``. ``default_mode`` names
    which ``modes`` entry ``amount`` was drawn from — the carrier mode
    token (``MONTHLY-EFT``, ``ANNUAL``, …), which itself encodes the
    recurrence, so premium carries no ``period`` field. ``modes`` is the
    full grid.
    """

    amount: V3Amount
    default_mode: str
    modes: Mapping[str, V3Amount]


@dataclass(frozen=True, slots=True)
class V3PricingRow:
    """One row of the uniform pricing table — a single rate class for one product."""

    rate_class: str
    primary: bool
    eligibility: V3Eligibility
    rank: int | None
    premium: V3Premium | None = None


@dataclass(frozen=True, slots=True)
class V3OfferCarrier:
    """Carrier identity for a v3 offer."""

    id: str
    name: str
    logo_url: str


@dataclass(frozen=True, slots=True)
class V3OfferProduct:
    """Product identity for a v3 offer."""

    id: str
    slug: str
    name: str
    display_name: str
    type: str
    wire_token: str


@dataclass(frozen=True, slots=True)
class V3Offer:
    """One product's v3 offer, returned identically by ``/v3/prequalify``
    and ``/v3/quote``.

    ``death_benefit`` is present (non-``None``) for life products
    (fex/term/preneed) as a one-time lump sum (``period=None``); it is
    ``None`` for premium-only products (medsup), whose coverage value
    lives entirely in ``pricing[].premium``. Always present as an
    attribute — ``None`` rather than absent — so consumers null-check it.
    ``budget`` is present only on monthly-budget quotes
    (``period="monthly"``, the requested budget — the stable grouping
    key for budget responses). Array order of :attr:`pricing` is
    authoritative for display — there is no ``result_index``, no
    client-side sort key, no synthetic rank.
    """

    object: Literal["plan_offer"]
    id: str
    eligible: bool
    carrier: V3OfferCarrier
    product: V3OfferProduct
    plan_info: Sequence[Mapping[str, Any]]
    death_benefit: V3Money | None
    pricing: Sequence[V3PricingRow]
    metadata: Mapping[str, Any]
    budget: V3Money | None = None


@dataclass(frozen=True, slots=True)
class PrequalifyV3Result:
    """Output of ``POST /v3/prequalify``.

    Always a flat :attr:`plans` sequence — single amount and
    multi-amount alike. Group client-side by the requested dimension
    with :func:`by_amount` (``death_benefit`` for face-amount requests,
    ``budget`` for monthly-budget requests); the shape never changes
    with the amount count.
    """

    plans: Sequence[V3Offer]
    request_id: str
    idempotency_key: str
    livemode: bool
    retry_attempts: int


def by_amount(plans: Sequence[V3Offer]) -> dict[int, list[V3Offer]]:
    """Group a flat ``plans`` sequence by the requested coverage dimension.

    When any offer carries a ``budget`` (a monthly-budget response) the
    offers key off ``budget.amount.cents``; otherwise off
    ``death_benefit.amount.cents`` (a face-amount response). Insertion
    order of first appearance is preserved (Python dicts are ordered) so
    callers can render a stable side-by-side table.

    In budget mode, an offer missing ``budget`` is an error per the
    grouping contract — the function skips it rather than falling back
    to death_benefit (which would mis-bucket mixed offers). In
    face-amount mode, an offer with a ``None`` death_benefit (a medsup
    product, which has no face amount) is likewise skipped — it has no
    face-amount dimension to group on.
    """
    is_budget = any(offer.budget is not None for offer in plans)
    grouped: dict[int, list[V3Offer]] = {}
    for offer in plans:
        dimension = offer.budget if is_budget else offer.death_benefit
        # Budget mode: missing budget is a contract violation. Face-amount
        # mode: a None death_benefit is a medsup product with no face-amount
        # dimension. Either way there is nothing to group on, so skip.
        if dimension is None:
            continue
        grouped.setdefault(dimension.amount.cents, []).append(offer)
    return grouped


def offer_premium(offer: V3Offer) -> V3Premium | None:
    """Return the premium facade for an offer.

    The :class:`V3Premium` of the single ``primary`` (best-qualifying)
    pricing row, or ``None`` when the offer has no qualifying row (every
    row ineligible, or the rare eligible row whose carrier returned no
    priceable mode). This is the one premium a list UI shows per product
    without walking :attr:`V3Offer.pricing`.
    """
    for row in offer.pricing:
        if row.primary:
            return row.premium
    return None


# ---------------------------------------------------------------------------
# Request inputs.
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class PrequalifyV3Options:
    """Options layered on top of the v3 prequalify request."""

    only_product_class: str | None = None
    include_product_class: Sequence[str] = ()
    min_rank: str | None = None
    show_unreleased: bool | None = None
    skip_health_based_underwriting: bool | None = None
    include_ineligible: bool | None = None


@dataclass(frozen=True, slots=True)
class PrequalifyV3Request:
    """Inputs accepted by :func:`prequalify_v3`."""

    applicant: Applicant
    coverage: Coverage
    products: ProductSelection
    options: PrequalifyV3Options | None = None


_PREQUALIFY_V3_PATH = "/v3/prequalify"


# ---------------------------------------------------------------------------
# Transport.
# ---------------------------------------------------------------------------


def prequalify_v3(
    request: PrequalifyV3Request,
    *,
    transport: Transport,
    base_url: str,
    headers: Mapping[str, str],
    idempotency_key: str | None = None,
) -> PrequalifyV3Result:
    """Run a v3 prequalify call.

    Serializes the wire body, mints a UUID v4 for ``Idempotency-Key``
    if the caller did not pass one, signs nothing (the caller hands in
    pre-built auth headers), and parses the envelope into typed
    offers. Returns a :class:`PrequalifyV3Result`; raises a typed
    :class:`~sah_sdk.core.errors.ISAError` on non-2xx.
    """
    body = serialize_v3_prequalify_body(
        applicant=request.applicant,
        coverage=request.coverage,
        products=request.products,
        options=request.options,
    )
    minted_key = idempotency_key or generate_idempotency_key()
    request_headers: dict[str, str] = {
        **dict(headers),
        "Content-Type": "application/json",
        "Idempotency-Key": minted_key,
        "Api-Version": "v3",
    }
    response = transport.request(
        "POST",
        f"{base_url}{_PREQUALIFY_V3_PATH}",
        headers=request_headers,
        body=body,
    )
    if response.status < 200 or response.status >= 300:
        raise from_http_response(
            response.status,
            response.body,
            request_id=response.request_id(),
            retry_after_seconds=_retry_after_seconds(response.headers),
        )
    return parse_prequalify_v3_envelope(
        response.body,
        idempotency_key=minted_key,
        retry_attempts=_retry_attempts_from_headers(response.headers),
    )


# ---------------------------------------------------------------------------
# Wire body serialization — v3 prequalify envelope shape.
#
# ``POST /v3/prequalify`` accepts the envelope ``PrequalifyV3Request``
# schema (``applicant`` + ``coverage`` + ``products[]``) — NOT the v2
# flat shape that ``/v3/quote`` still consumes via
# :func:`serialize_wire_body` below. Emitting the v2 flat shape against
# ``/v3/prequalify`` produces ``unknown field "date_of_birth"`` from
# the zyins server (prod incident, 2026-05-29).
#
# See ``PrequalifyV3Request`` / ``ApplicantV3Input`` / ``CoverageV3Input``
# / ``NicotineUsageInput`` in ``go/zyins/api/openapi.yaml`` (canonical
# source).
# ---------------------------------------------------------------------------


# v3 nicotine frequency enum the server accepts (``NicotineFrequencyV3``).
# The Tier 3 SDK currently surfaces v2-grade strings on
# :class:`NicotineProductUsage.frequency` (e.g. ``DAILY``, ``WEEKLY``); we
# coerce here so v3 callers do not need to know the wire enum names.
_V3_NICOTINE_FREQUENCY: Mapping[str, str] = MappingProxyType(
    {
        "daily": "daily",
        "DAILY": "daily",
        "weekly": "few_times_per_week",
        "WEEKLY": "few_times_per_week",
        "few_times_per_week": "few_times_per_week",
        "monthly": "few_times_per_month",
        "MONTHLY": "few_times_per_month",
        "few_times_per_month": "few_times_per_month",
        "yearly": "few_times_per_year",
        "YEARLY": "few_times_per_year",
        "few_times_per_year": "few_times_per_year",
    }
)
_V3_NICOTINE_DEFAULT_FREQUENCY = "daily"

# Cents per dollar. The v3 coverage envelope speaks integer cents.
_CENTS_PER_DOLLAR = 100


def _dollars_to_cents(amount: int | float) -> int:
    return round(float(amount) * _CENTS_PER_DOLLAR)


def _serialize_v3_condition(c: Condition) -> dict[str, Any]:
    """Serialize a :class:`Condition` into ``ConditionV3Input`` shape.

    SDK condition rows carry a freeform ``name``; v3 accepts that as
    ``text`` (with optional opaque catalog ``id`` from
    ``GET /v3/datasets``). Date fields pass through verbatim — the
    engine accepts ISO 8601, US format, and relative phrases.
    """
    row: dict[str, Any] = {"text": c.name}
    if c.was_diagnosed:
        row["was_diagnosed"] = c.was_diagnosed
    if c.last_treatment:
        row["last_treatment"] = c.last_treatment
    return row


def _serialize_v3_medication(m: Medication) -> dict[str, Any]:
    """Serialize a :class:`Medication` into ``MedicationV3Input`` shape.

    SDK medications carry freeform ``name``; v3 accepts that as
    ``text``. ``use``, ``first_fill``, ``last_fill`` pass through.
    """
    row: dict[str, Any] = {"text": m.name}
    if m.use:
        row["use"] = m.use
    if m.first_fill:
        row["first_fill"] = m.first_fill
    if m.last_fill:
        row["last_fill"] = m.last_fill
    return row


def _serialize_v3_nicotine_specificity(p: NicotineProductUsage) -> dict[str, Any]:
    """Serialize one :class:`NicotineProductUsage` into
    ``NicotineSpecificityInput`` shape.

    The v2 SDK calls the freeform name ``type``; v3 calls it ``text``.
    Frequency is mapped through :data:`_V3_NICOTINE_FREQUENCY` so
    v2-grade strings (``DAILY``, ``WEEKLY``) become valid v3 enum
    values (``daily``, ``few_times_per_week``).
    """
    return {
        "text": p.type,
        "frequency": _V3_NICOTINE_FREQUENCY.get(p.frequency, _V3_NICOTINE_DEFAULT_FREQUENCY),
    }


def _serialize_v3_nicotine(
    nicotine_use: NicotineUsageInput | NicotineUsage,
) -> dict[str, Any]:
    """Serialize ``applicant.nicotine_use`` into ``NicotineUsageInput`` shape.

    Per the OpenAPI schema: ``{last_used, specificity[]}``. The
    deprecated legacy :class:`NicotineUsage` three-state enum widens
    to ``Never`` / ``Within12Months`` / ``12_to_24_months`` per the
    existing v2 compatibility mapping.
    """
    if isinstance(nicotine_use, NicotineUsageInput):
        result: dict[str, Any] = {"last_used": nicotine_use.last_used.value}
        if nicotine_use.product_usage:
            result["specificity"] = [
                _serialize_v3_nicotine_specificity(p) for p in nicotine_use.product_usage
            ]
        return result
    legacy_map = {
        NicotineUsage.NONE: NicotineDuration.NEVER,
        NicotineUsage.CURRENT: NicotineDuration.WITHIN_12_MONTHS,
        NicotineUsage.FORMER: NicotineDuration.N12_TO_24_MONTHS,
    }
    return {"last_used": legacy_map.get(nicotine_use, NicotineDuration.NEVER).value}


def _serialize_v3_coverage(coverage: Coverage, state: str, zip_code: str | None) -> dict[str, Any]:
    """Build the v3 coverage envelope from the input shape.

    Single face amount keeps the proven ``{face_amount_cents}`` shape
    (integer cents). A single monthly budget and any multi-amount probe
    ride the ``/v3/quote`` ``quote_options`` block — ``{quote_type,
    amounts}`` — satisfying the server's additive ``face_amount_cents``
    XOR ``quote_options`` contract (zyins #400). ``state`` and ``zip``
    ride the envelope in every case; ``zip`` is omitted when the caller
    supplied none — the server pattern ``^\\d{5}(-\\d{4})?$`` rejects an
    empty string and zip is required only for medsup quotes.
    """
    locale: dict[str, Any] = {"state": state}
    if zip_code:
        locale["zip"] = zip_code
    if coverage.is_multi:
        quote_type = (
            QuoteType.FACE_AMOUNTS.value
            if coverage.type is CoverageType.FACE_VALUE
            else QuoteType.MONTHLY_BUDGET.value
        )
        return {
            "quote_options": {
                "quote_type": quote_type,
                "amounts": [str(a) for a in coverage.amounts],
            },
            **locale,
        }
    # A single monthly budget has no face_amount_cents to express, so it
    # rides the quote_options block with one amount — the same path the
    # server accepts for the multi-amount budget probe. A single face
    # amount keeps the proven face_amount_cents wire shape.
    if not coverage.is_face_value:
        return {
            "quote_options": {
                "quote_type": QuoteType.MONTHLY_BUDGET.value,
                "amounts": [str(coverage.amount)],
            },
            **locale,
        }
    return {
        "face_amount_cents": _dollars_to_cents(coverage.amount),
        **locale,
    }


def serialize_v3_prequalify_body(
    *,
    applicant: Applicant,
    coverage: Coverage,
    products: ProductSelection,
    options: PrequalifyV3Options | None = None,
) -> str:
    """Build the ``PrequalifyV3Request`` wire body — the envelope shape.

    Coverage serialization is shape-driven (see
    :func:`_serialize_v3_coverage`): a single face amount sends
    ``coverage.face_amount_cents``; a single monthly budget or a
    multi-amount probe sends ``coverage.quote_options`` (mirroring
    ``/v3/quote``). The server (zyins #400) answers every shape with a
    flat ``plans`` array. ``applicant.state`` and ``applicant.zip`` move
    into the coverage envelope per the v3 schema (``zip`` is required for
    medsup quotes; the server zip-gates and silently filters medsup
    products when it is absent).

    ``options.min_rank``, ``options.show_unreleased``,
    ``options.skip_health_based_underwriting``, ``options.only_product_class``,
    ``options.include_product_class`` are NOT part of the v3 prequalify
    envelope and are silently dropped — they survive on ``/v3/quote``
    via :func:`serialize_wire_body`.
    """
    applicant_wire: dict[str, Any] = {
        "sex": applicant.sex.value,
        "dob": applicant.dob,
        "height_inches": applicant.height_inches,
        "weight_lbs": applicant.weight_pounds,
        "nicotine": _serialize_v3_nicotine(applicant.nicotine_use),
    }
    if applicant.conditions:
        applicant_wire["conditions"] = [_serialize_v3_condition(c) for c in applicant.conditions]
    if applicant.medications:
        applicant_wire["medications"] = [_serialize_v3_medication(m) for m in applicant.medications]
    payload: dict[str, Any] = {
        "applicant": applicant_wire,
        "coverage": _serialize_v3_coverage(coverage, applicant.state, applicant.zip),
        "products": list(products.to_wire_array()),
    }
    if options is not None and options.include_ineligible is not None:
        payload["include_ineligible"] = options.include_ineligible
    else:
        payload["include_ineligible"] = True
    return json.dumps(payload, separators=(",", ":"))


# ---------------------------------------------------------------------------
# Wire body serialization — v3 quote (legacy flat shape).
#
# ``POST /v3/quote`` currently consumes the v2 ``QuoteRequest`` flat body
# (see ``openapi.yaml`` operation ``quoteV3``). Kept here as the shared
# serializer until ``/v3/quote`` is migrated to its own envelope. DO NOT
# use this against ``/v3/prequalify`` — that path requires the envelope
# shape from :func:`serialize_v3_prequalify_body`.
# ---------------------------------------------------------------------------


def serialize_wire_body(
    *,
    applicant: Applicant,
    coverage: Coverage,
    products: ProductSelection,
    options: PrequalifyV3Options | None = None,
) -> str:
    """Build the v2-flat wire body for ``/v3/quote``."""
    payload: dict[str, Any] = {
        "date_of_birth": applicant.dob,
        "gender": applicant.sex.value,
        "height": applicant.height_inches,
        "weight": applicant.weight_pounds,
        "state": applicant.state,
        "nicotine_usage": _serialize_nicotine_usage(applicant.nicotine_use),
        "conditions": [c.model_dump() for c in applicant.conditions],
        "medications": [m.model_dump() for m in applicant.medications],
        "quote_options": {
            "quote_type": (
                QuoteType.FACE_AMOUNTS.value
                if coverage.type is CoverageType.FACE_VALUE
                else QuoteType.MONTHLY_BUDGET.value
            ),
            "amounts": [str(coverage.amount)],
        },
        "products": list(products.to_wire_array()),
    }
    if applicant.zip is not None:
        payload["zip"] = applicant.zip
    if options is not None:
        if options.only_product_class is not None:
            payload["only_product_class"] = options.only_product_class
        if options.include_product_class:
            existing = payload.get("include_product_class")
            base = list(existing) if isinstance(existing, list) else []
            seen = set(base)
            for token in options.include_product_class:
                if token not in seen:
                    base.append(token)
                    seen.add(token)
            payload["include_product_class"] = base
        if options.min_rank is not None:
            payload["min_rank"] = options.min_rank
        if options.show_unreleased is not None:
            payload["show_unreleased"] = options.show_unreleased
        if options.skip_health_based_underwriting is not None:
            payload["skip_health_based_underwriting"] = options.skip_health_based_underwriting
        if options.include_ineligible is not None:
            payload["include_ineligible"] = options.include_ineligible
    payload.setdefault("include_ineligible", True)
    return json.dumps(payload, separators=(",", ":"))


def _serialize_nicotine_usage(
    nicotine_use: NicotineUsageInput | NicotineUsage,
) -> dict[str, Any]:
    if isinstance(nicotine_use, NicotineUsageInput):
        result: dict[str, Any] = {"last_used": nicotine_use.last_used.value}
        if nicotine_use.product_usage:
            result["product_usage"] = [
                {"type": p.type, "frequency": p.frequency} for p in nicotine_use.product_usage
            ]
        return result
    legacy_map = {
        NicotineUsage.NONE: NicotineDuration.NEVER,
        NicotineUsage.CURRENT: NicotineDuration.WITHIN_12_MONTHS,
        NicotineUsage.FORMER: NicotineDuration.N12_TO_24_MONTHS,
    }
    return {"last_used": legacy_map.get(nicotine_use, NicotineDuration.NEVER).value}


# ---------------------------------------------------------------------------
# Response parsing.
# ---------------------------------------------------------------------------


def parse_prequalify_v3_envelope(
    body: str, *, idempotency_key: str = "", retry_attempts: int = 0
) -> PrequalifyV3Result:
    """Parse a ``/v3/prequalify`` envelope body into a :class:`PrequalifyV3Result`.

    Exposed for tests; callers driving the parser against captured
    response bodies use this directly.
    """
    try:
        parsed = json.loads(body)
    except json.JSONDecodeError as exc:
        raise ValueError(f"ZyIns prequalify_v3: failed to parse response body: {exc.msg}") from exc
    root = parsed if isinstance(parsed, dict) else {}
    request_id = _to_str(root.get("request_id"))
    echo_key = _to_str(root.get("idempotency_key")) or idempotency_key
    livemode_raw = root.get("livemode")
    livemode = True if livemode_raw is None else _to_bool(livemode_raw)
    data_raw = root.get("data")
    data = data_raw if isinstance(data_raw, dict) else {}
    # The v3 response is always a flat ``plans[]`` array — single amount
    # and multi-amount alike. Group client-side with :func:`by_amount` on
    # the requested dimension (death_benefit for face amounts, budget for
    # monthly budgets).
    # Absent plans (vs present-but-empty) indicates wire-shape drift; fail fast.
    if "plans" not in data:
        raise ValueError("ZyIns prequalify_v3: missing plans field in v3 response")
    plans_raw = data["plans"]
    plans_seq = plans_raw if isinstance(plans_raw, list) else []
    plans = tuple(_coerce_offer(p) for p in plans_seq)
    return PrequalifyV3Result(
        plans=plans,
        request_id=request_id,
        idempotency_key=echo_key,
        livemode=livemode,
        retry_attempts=retry_attempts,
    )


# ---------------------------------------------------------------------------
# Coercion helpers — shared with quote_v3.
# ---------------------------------------------------------------------------


def _to_str(value: object) -> str:
    return value if isinstance(value, str) else ""


def _to_bool(value: object) -> bool:
    if isinstance(value, bool):
        return value
    return False


def _to_int(value: object) -> int:
    """Coerce a JSON-ish value to ``int`` for integer-cents fields.

    Cents are integers on the wire. A float here is server bug or
    JSON corruption; we accept whole-valued floats (``8742.0``) for
    forward compatibility but reject non-integral floats rather than
    silently truncating. Bools, NaN/Inf, and other types fall back to
    ``0`` so downstream consumers always see an integer.
    """
    if isinstance(value, bool):
        return 0
    if isinstance(value, int):
        return value
    if isinstance(value, float) and math.isfinite(value) and value.is_integer():
        return int(value)
    return 0


def _to_nullable_int(value: object) -> int | None:
    """``_to_int`` variant that preserves ``None`` for absent fields."""
    if value is None:
        return None
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float) and math.isfinite(value) and value.is_integer():
        return int(value)
    return None


def coerce_amount(raw: object) -> V3Amount:
    """Coerce the leaf ``{cents, display}`` amount (OpenAPI ``AmountResponse``)."""
    if not isinstance(raw, dict):
        return V3Amount(cents=0, display="")
    return V3Amount(cents=_to_int(raw.get("cents")), display=_to_str(raw.get("display")))


def coerce_money(raw: object) -> V3Money:
    """Coerce a ``{amount: {cents, display}, period}`` value (OpenAPI ``Money``).

    ``period`` falls back to ``None`` (a one-time lump sum) for any value
    outside the closed enum, so an unknown future period never poisons the
    type.
    """
    if not isinstance(raw, dict):
        return V3Money(amount=V3Amount(cents=0, display=""), period=None)
    period_raw = raw.get("period")
    period: V3Period | None = period_raw if period_raw in _V3_PERIODS else None
    return V3Money(amount=coerce_amount(raw.get("amount")), period=period)


def coerce_carrier(raw: object) -> V3OfferCarrier:
    if not isinstance(raw, dict):
        return V3OfferCarrier(id="", name="", logo_url="")
    return V3OfferCarrier(
        id=_to_str(raw.get("id")),
        name=_to_str(raw.get("name")),
        logo_url=_to_str(raw.get("logo_url")),
    )


def coerce_product(raw: object) -> V3OfferProduct:
    if not isinstance(raw, dict):
        return V3OfferProduct(id="", slug="", name="", display_name="", type="", wire_token="")
    return V3OfferProduct(
        id=_to_str(raw.get("id")),
        slug=_to_str(raw.get("slug")),
        name=_to_str(raw.get("name")),
        display_name=_to_str(raw.get("display_name")),
        type=_to_str(raw.get("type")),
        wire_token=_to_str(raw.get("wire_token")),
    )


def _coerce_eligibility(raw: object) -> V3Eligibility:
    if not isinstance(raw, dict):
        return V3Eligibility(category=None, eligible=False, reasons=())
    category_raw = raw.get("category")
    category: V3EligibilityCategory | None
    if category_raw in {"immediate", "graded", "rop", "other"}:
        category = V3EligibilityCategory(category_raw)
    else:
        category = None
    reasons_raw = raw.get("reasons")
    reasons = (
        tuple(_to_str(r) for r in reasons_raw if isinstance(r, str))
        if isinstance(reasons_raw, list)
        else ()
    )
    return V3Eligibility(
        category=category,
        eligible=_to_bool(raw.get("eligible")),
        reasons=reasons,
    )


def _coerce_premium(raw: object) -> V3Premium | None:
    if raw is None or not isinstance(raw, dict):
        return None
    modes_raw = raw.get("modes")
    modes: dict[str, V3Amount] = {}
    if isinstance(modes_raw, dict):
        for mode_name, mode_money in modes_raw.items():
            modes[mode_name] = coerce_amount(mode_money)
    default_mode = _to_str(raw.get("default_mode"))
    # ``amount`` is byte-identical to ``modes[default_mode]``; read it from the
    # wire ``amount`` when present, else fall back to the mode grid so a server
    # that only populated ``modes`` still yields the headline value.
    if raw.get("amount") is not None:
        amount = coerce_amount(raw.get("amount"))
    else:
        amount = modes.get(default_mode, coerce_amount(None))
    return V3Premium(
        amount=amount,
        default_mode=default_mode,
        modes=MappingProxyType(modes),
    )


def coerce_pricing_row(raw: object) -> V3PricingRow:
    obj = raw if isinstance(raw, dict) else {}
    return V3PricingRow(
        rate_class=_to_str(obj.get("rate_class")),
        primary=_to_bool(obj.get("primary")),
        eligibility=_coerce_eligibility(obj.get("eligibility")),
        rank=_to_nullable_int(obj.get("rank")),
        premium=_coerce_premium(obj.get("premium")),
    )


def _coerce_plan_info(raw: object) -> Sequence[Mapping[str, Any]]:
    if not isinstance(raw, list):
        return ()
    return tuple(item for item in raw if isinstance(item, dict))


def _coerce_offer(raw: object) -> V3Offer:
    obj = raw if isinstance(raw, dict) else {}
    pricing_raw = obj.get("pricing")
    pricing = (
        tuple(coerce_pricing_row(row) for row in pricing_raw)
        if isinstance(pricing_raw, list)
        else ()
    )
    metadata_raw = obj.get("metadata")
    metadata = metadata_raw if isinstance(metadata_raw, dict) else {}
    budget_raw = obj.get("budget")
    budget = coerce_money(budget_raw) if isinstance(budget_raw, dict) else None
    # death_benefit is null on the wire for premium-only products (medsup); a
    # Money object for life products. Preserve None rather than coercing it into
    # a zero-cents Money, so consumers null-check medsup correctly.
    death_benefit_raw = obj.get("death_benefit")
    death_benefit = coerce_money(death_benefit_raw) if isinstance(death_benefit_raw, dict) else None
    return V3Offer(
        object="plan_offer",
        id=_to_str(obj.get("id")),
        eligible=_to_bool(obj.get("eligible")),
        carrier=coerce_carrier(obj.get("carrier")),
        product=coerce_product(obj.get("product")),
        plan_info=_coerce_plan_info(obj.get("plan_info")),
        death_benefit=death_benefit,
        pricing=pricing,
        metadata=MappingProxyType(dict(metadata)),
        budget=budget,
    )


def _retry_after_seconds(headers: Mapping[str, str]) -> float | None:
    """Read ``Retry-After`` as seconds; ``None`` when missing or HTTP-date.

    The platform sets ``Retry-After`` in delta-seconds form on 429 /
    503 responses. We do not parse the HTTP-date variant here — the
    server contract is seconds-only and ``from_http_response`` accepts
    ``None`` for "unknown" so the typed error still surfaces the rate
    limit, just without a numeric retry hint.
    """
    for header_name, header_value in headers.items():
        if header_name.lower() == "retry-after":
            try:
                return float(header_value)
            except (TypeError, ValueError):
                return None
    return None


def _retry_attempts_from_headers(headers: Mapping[str, str]) -> int:
    """Mirror the TS ``retryAttemptsFromHeaders`` semantics.

    The platform surfaces the count via either ``Retry-Attempts`` or
    ``X-Retry-Attempts``. Missing / malformed values default to 0.
    """
    for key in ("retry-attempts", "x-retry-attempts"):
        for header_name, header_value in headers.items():
            if header_name.lower() == key:
                try:
                    return int(header_value)
                except (TypeError, ValueError):
                    return 0
    return 0


__all__ = [
    "PrequalifyV3Options",
    "PrequalifyV3Request",
    "PrequalifyV3Result",
    "V3Amount",
    "V3Eligibility",
    "V3EligibilityCategory",
    "V3Money",
    "V3Offer",
    "V3OfferCarrier",
    "V3OfferProduct",
    "V3Period",
    "V3Premium",
    "V3PricingRow",
    "by_amount",
    "coerce_amount",
    "coerce_carrier",
    "coerce_money",
    "coerce_pricing_row",
    "coerce_product",
    "parse_prequalify_v3_envelope",
    "prequalify_v3",
    "serialize_v3_prequalify_body",
    "serialize_wire_body",
]
