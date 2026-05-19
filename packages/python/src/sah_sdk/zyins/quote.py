"""Quote operation.

The quote endpoint is a superset of prequalify: it returns full
premium tables plus carrier-specific rider options. The TS SDK does
not yet expose ``quote`` as a top-level method (it is reached via the
case workflow); the Python SDK promotes it to a first-class operation
per the surface spec.
"""

from __future__ import annotations

import json
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from ..core.wire import applicant_to_wire_dict, load_json_object, request_id_from_envelope
from .applicant import Applicant
from .coverage import Coverage
from .product import ProductSelection


class QuoteInput(BaseModel):
    """Inputs accepted by :meth:`QuoteSubClient.run`."""

    model_config = ConfigDict(extra="forbid", arbitrary_types_allowed=True, frozen=True)

    applicant: Applicant
    coverage: Coverage
    products: str | ProductSelection
    riders: tuple[str, ...] = Field(default_factory=tuple)

    def to_wire_body(self) -> str:
        products_wire = (
            self.products.to_wire_string()
            if isinstance(self.products, ProductSelection)
            else self.products
        )
        payload: dict[str, Any] = {
            "products": products_wire,
            "riders": list(self.riders),
            "applicant": applicant_to_wire_dict(self.applicant),
            "coverage": {
                "type": self.coverage.type.value,
                "amount": self.coverage.amount,
            },
        }
        return json.dumps(payload, separators=(",", ":"))


class QuotedPlan(BaseModel):
    """One quoted plan with the full premium ladder."""

    model_config = ConfigDict(extra="ignore", frozen=True)

    brand: str = ""
    tier: str = ""
    product_token: str = ""
    monthly_premium: float = 0.0
    annual_premium: float = 0.0
    face_value: int = 0
    rider_premiums: dict[str, float] = Field(default_factory=dict)


class QuoteResult(BaseModel):
    """Output of :meth:`QuoteSubClient.run`."""

    model_config = ConfigDict(extra="ignore", frozen=True)

    plans: tuple[QuotedPlan, ...] = ()
    request_id: str = ""


def parse_quote_response(body: str) -> QuoteResult:
    raw = load_json_object(body, context="quote")
    plans_raw = raw.get("plans")
    if not isinstance(plans_raw, list):
        plans_raw = []
    plans = tuple(QuotedPlan.model_validate(p) for p in plans_raw)
    return QuoteResult(plans=plans, request_id=request_id_from_envelope(raw))
