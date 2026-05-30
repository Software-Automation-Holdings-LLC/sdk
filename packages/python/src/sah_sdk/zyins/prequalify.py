"""Prequalify operation.

Mirrors ``packages/ts/src/zyins/prequalify.ts``.

Wire shape (verified against server ``PrequalifyRequest`` struct)::

    {
        "date_of_birth": "YYYY-MM-DD",
        "gender": "male" | "female",
        "height": <inches>,
        "weight": <pounds>,
        "state": "<state>",
        "zip": "<zip>",
        "nicotine_usage": { "last_used": "<NicotineLastUsed>", "product_usage": [...] },
        "products": ["<slug>", ...],
        "conditions": [...],
        "medications": [...],
        "quote_options": { "amounts": ["<amount>"], "quote_type": "face_amounts" | "monthly_budget" }
    }

Auth credentials belong in HMAC headers only — never in the body.
"""

from __future__ import annotations

import json
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from ..core.wire import load_json_object, request_id_from_envelope
from .applicant import Applicant, NicotineDuration, NicotineUsage, NicotineUsageInput
from .coverage import Coverage, CoverageType, QuoteType
from .product import ProductSelection

_PRODUCT_TOKEN_SEPARATOR = "|"


class PrequalifyInput(BaseModel):
    """Inputs accepted by :meth:`PrequalifySubClient.run`."""

    model_config = ConfigDict(extra="forbid", arbitrary_types_allowed=True, frozen=True)

    applicant: Applicant
    coverage: Coverage
    # Accept either a ProductSelection (modern) or a raw wire token string.
    products: str | ProductSelection

    def to_wire_body(self) -> str:
        """Serialize to the flat wire body the server expects."""
        return _serialize_wire_body(self)


class Carrier(BaseModel):
    """Carrier identity for a returned plan.

    Mirrors the v2 wire shape: a flat object with ``id`` (stable
    machine-friendly slug, e.g. ``"aetna-accendo"``) and ``name``
    (human-readable display, e.g. ``"Aetna Accendo"``). Forward-compatible
    fields the server emits but the SDK does not yet model are
    silently dropped (``extra="ignore"``).
    """

    model_config = ConfigDict(extra="ignore", frozen=True)

    id: str = ""
    name: str = ""


class PlanProduct(BaseModel):
    """Product identity for a returned plan.

    Mirrors the v2 wire shape: ``wire_token`` is the slug used in
    catalog look-ups (``"fex"``, ``"term"``, ``"medsup"``…) and
    ``display_name`` is the human-readable label.
    """

    model_config = ConfigDict(extra="ignore", frozen=True)

    wire_token: str = ""
    display_name: str = ""


class Eligibility(BaseModel):
    """Eligibility decision for a returned plan.

    Mirrors the v2 wire shape: ``eligible`` (bool), ``category`` (one of
    ``"immediate"`` / ``"graded"`` / ``"rop"`` / carrier-specific values),
    and ``coverage_tier`` (verbatim carrier tier label, deprecated for
    new code in favor of ``category``).
    """

    model_config = ConfigDict(extra="ignore", frozen=True)

    eligible: bool = False
    category: str = ""
    coverage_tier: str = ""


class Premium(BaseModel):
    """Premium pricing for a returned plan.

    Mirrors the v2 wire shape:

    * ``cents`` — integer minor units, never floats.
    * ``display`` — verbatim carrier-formatted string (``"$87.42"``).
    * ``mode`` — billing cadence (``"monthly"`` / ``"annual"`` / …).
    * ``modes`` — alternate cadences, keyed by mode name.
    * ``rate_class`` — underwriting class (``"preferred"``,
      ``"standard-tobacco"``, …).
    """

    model_config = ConfigDict(extra="ignore", frozen=True)

    cents: int = 0
    display: str = ""
    mode: str = ""
    modes: dict[str, int] = Field(default_factory=dict)
    rate_class: str = ""


class PrequalifyPlan(BaseModel):
    """One plan returned by the engine.

    Carries both the v2 typed sub-objects (``carrier``, ``product``,
    ``eligibility``, ``premium``) and the legacy flat fields (``brand``,
    ``tier``, ``monthly_premium``, ``face_value``, ``product_token``)
    for backward compatibility with v0.4.x consumers. New code should
    use the typed sub-objects.
    """

    model_config = ConfigDict(extra="ignore", frozen=True)

    # v2 typed sub-objects (canonical going forward).
    carrier: Carrier = Field(default_factory=Carrier)
    product: PlanProduct = Field(default_factory=PlanProduct)
    eligibility: Eligibility = Field(default_factory=Eligibility)
    premium: Premium | None = None

    # Legacy flat fields (kept for backward compatibility).
    brand: str = ""
    tier: str = ""
    monthly_premium: float = Field(default=0.0, alias="monthly_premium")
    face_value: int = Field(default=0, alias="face_value")
    product_token: str = Field(default="", alias="product_token")


class PrequalifyResult(BaseModel):
    """Output of :meth:`PrequalifySubClient.run`."""

    model_config = ConfigDict(extra="ignore", frozen=True)

    plans: tuple[PrequalifyPlan, ...] = ()
    request_id: str = ""


def _nicotine_usage_to_wire(
    nicotine_use: NicotineUsageInput | NicotineUsage,
) -> dict[str, Any]:
    """Map nicotine usage to the flat ``nicotine_usage`` wire sub-object."""
    if isinstance(nicotine_use, NicotineUsageInput):
        result: dict[str, Any] = {"last_used": nicotine_use.last_used.value}
        if nicotine_use.product_usage:
            result["product_usage"] = [
                {"type": p.type, "frequency": p.frequency} for p in nicotine_use.product_usage
            ]
        return result
    # Deprecated NicotineUsage enum — map to nearest NicotineDuration bucket.
    _legacy_map = {
        NicotineUsage.NONE: NicotineDuration.NEVER,
        NicotineUsage.CURRENT: NicotineDuration.WITHIN_12_MONTHS,
        NicotineUsage.FORMER: NicotineDuration.N12_TO_24_MONTHS,
    }
    duration = _legacy_map.get(nicotine_use, NicotineDuration.NEVER)
    return {"last_used": duration.value}


def _quote_options_to_wire(coverage: Coverage) -> dict[str, Any]:
    quote_type = (
        QuoteType.FACE_AMOUNTS
        if coverage.type is CoverageType.FACE_VALUE
        else QuoteType.MONTHLY_BUDGET
    )
    return {
        "amounts": [str(coverage.amount)],
        "quote_type": quote_type.value,
    }


def _serialize_wire_body(request: PrequalifyInput) -> str:
    """Build the flat wire body.

    Auth credentials must never appear here; they belong in HMAC headers.
    No ``applicant``/``coverage`` nesting on the wire per ADR-035.
    """
    applicant = request.applicant
    if isinstance(request.products, ProductSelection):
        products_wire: list[str] = list(request.products.to_wire_array())
    else:
        products_wire = [
            product
            for product in request.products.split(_PRODUCT_TOKEN_SEPARATOR)
            if product
        ]

    payload: dict[str, Any] = {
        "date_of_birth": applicant.dob,
        "gender": applicant.sex.value,
        "height": applicant.height_inches,
        "weight": applicant.weight_pounds,
        "state": applicant.state,
        "nicotine_usage": _nicotine_usage_to_wire(applicant.nicotine_use),
        "products": products_wire,
        "conditions": [c.model_dump() for c in applicant.conditions],
        "medications": [m.model_dump() for m in applicant.medications],
        "quote_options": _quote_options_to_wire(request.coverage),
    }
    if applicant.zip is not None:
        payload["zip"] = applicant.zip
    return json.dumps(payload, separators=(",", ":"))


def _coerce_plan(raw: Any) -> PrequalifyPlan:
    """Build a :class:`PrequalifyPlan` tolerantly from a wire dict.

    Synthesizes the v2 typed sub-objects (``carrier``, ``product``,
    ``eligibility``, ``premium``) when only legacy flat fields are
    present, so docs can index into ``plan.carrier.name`` etc. against
    either wire generation without consumer-side branching.
    """
    if not isinstance(raw, dict):
        raise ValueError("prequalify response plan entries must be objects")
    if "brand" in raw and raw["brand"] is not None:
        raw = _with_nested_value(raw, "carrier", "name", raw["brand"])
    if "product_token" in raw and raw["product_token"] is not None:
        raw = _with_nested_value(raw, "product", "wire_token", raw["product_token"])
    if "tier" in raw and raw["tier"] is not None:
        raw = _with_nested_value(raw, "eligibility", "coverage_tier", raw["tier"])
    if (
        "monthly_premium" in raw
        and raw["monthly_premium"] is not None
        and _should_synthesize_premium(raw.get("premium"))
    ):
        cents = round(float(raw["monthly_premium"]) * 100)
        premium = raw.get("premium") if isinstance(raw.get("premium"), dict) else {}
        raw = {
            **raw,
            "premium": {**premium, "cents": cents, "mode": "monthly"},
        }
    return PrequalifyPlan.model_validate(raw)


def _should_synthesize_premium(premium: Any) -> bool:
    return not isinstance(premium, dict) or "cents" not in premium


def _with_nested_value(
    raw: dict[str, Any], object_key: str, value_key: str, value: Any
) -> dict[str, Any]:
    current = raw.get(object_key)
    if isinstance(current, dict):
        if value_key in current:
            return raw
        return {**raw, object_key: {**current, value_key: value}}
    if current is None:
        return {**raw, object_key: {value_key: value}}
    return raw


def parse_prequalify_response(body: str) -> PrequalifyResult:
    """Parse the engine's JSON response into the typed result.

    Lenient: unknown fields are ignored, missing fields default. This
    matches the TS ``coercePlan`` behavior so a forward-compatible
    field addition does not break parsing.
    """
    raw = load_json_object(body, context="prequalify")
    plans_raw = raw.get("plans")
    if not isinstance(plans_raw, list):
        plans_raw = []
    plans = tuple(_coerce_plan(p) for p in plans_raw)
    return PrequalifyResult(plans=plans, request_id=request_id_from_envelope(raw))
