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


class PrequalifyPlan(BaseModel):
    """One plan returned by the engine."""

    model_config = ConfigDict(extra="ignore", frozen=True)

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
    plans = tuple(PrequalifyPlan.model_validate(p) for p in plans_raw)
    return PrequalifyResult(plans=plans, request_id=request_id_from_envelope(raw))
