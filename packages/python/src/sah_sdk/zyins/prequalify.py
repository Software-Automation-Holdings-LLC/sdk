"""Prequalify operation.

Mirrors ``packages/zyins/js/src/prequalify.ts`` but exposed as
``client.prequalify.run(input)`` per the Python surface spec.
"""

from __future__ import annotations

import json
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from ..core.wire import applicant_to_wire_dict, load_json_object, request_id_from_envelope
from .applicant import Applicant
from .coverage import Coverage
from .product import ProductSelection


class PrequalifyInput(BaseModel):
    """Inputs accepted by :meth:`PrequalifySubClient.run`."""

    model_config = ConfigDict(extra="forbid", arbitrary_types_allowed=True, frozen=True)

    applicant: Applicant
    coverage: Coverage
    # Accept either a raw wire string, a ProductSelection, or a single token.
    products: str | ProductSelection

    def to_wire_body(self) -> str:
        """Serialize to the engine's JSON body."""
        products_wire = (
            self.products.to_wire_string()
            if isinstance(self.products, ProductSelection)
            else self.products
        )
        payload: dict[str, Any] = {
            "products": products_wire,
            "applicant": applicant_to_wire_dict(self.applicant),
            "coverage": {
                "type": self.coverage.type.value,
                "amount": self.coverage.amount,
            },
        }
        return json.dumps(payload, separators=(",", ":"))


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
