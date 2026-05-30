"""Tests for the v2 typed sub-objects on :class:`PrequalifyPlan`.

The cross-language quickstart accesses ``plan.carrier.name``,
``plan.product.display_name``, ``plan.eligibility.category``, and
``plan.premium.display`` / ``.cents``. These tests verify the SDK
surfaces those fields whether the wire body uses the v2 typed shape
directly or the legacy flat keys.
"""

from __future__ import annotations

import json

import pytest

from sah_sdk.zyins.prequalify import (
    Carrier,
    Eligibility,
    PlanProduct,
    Premium,
    PrequalifyPlan,
    parse_prequalify_response,
)


class TestPrequalifyPlanV2Fields:
    def test_typed_subobjects_are_populated_from_v2_wire(self) -> None:
        body = json.dumps(
            {
                "plans": [
                    {
                        "carrier": {"id": "aetna-accendo", "name": "Aetna Accendo"},
                        "product": {
                            "wire_token": "fex",
                            "display_name": "Final Expense",
                        },
                        "eligibility": {
                            "eligible": True,
                            "category": "immediate",
                            "coverage_tier": "level",
                        },
                        "premium": {
                            "cents": 8742,
                            "display": "$87.42",
                            "mode": "monthly",
                            "modes": {"monthly": 8742, "annual": 100000},
                            "rate_class": "preferred",
                        },
                    }
                ]
            }
        )

        result = parse_prequalify_response(body)

        plan = result.plans[0]
        assert plan.carrier.id == "aetna-accendo"
        assert plan.carrier.name == "Aetna Accendo"
        assert plan.product.wire_token == "fex"
        assert plan.product.display_name == "Final Expense"
        assert plan.eligibility.eligible is True
        assert plan.eligibility.category == "immediate"
        assert plan.eligibility.coverage_tier == "level"
        assert plan.premium is not None
        assert plan.premium.cents == 8742
        assert plan.premium.display == "$87.42"
        assert plan.premium.mode == "monthly"
        assert plan.premium.modes == {"monthly": 8742, "annual": 100000}
        assert plan.premium.rate_class == "preferred"

    def test_synthesizes_v2_shape_from_legacy_flat_fields(self) -> None:
        body = json.dumps(
            {
                "plans": [
                    {
                        "brand": "Colonial Penn",
                        "tier": "level",
                        "product_token": "fex",
                        "monthly_premium": 29.0,
                        "face_value": 25000,
                    }
                ]
            }
        )

        result = parse_prequalify_response(body)

        plan = result.plans[0]
        assert plan.carrier.name == "Colonial Penn"
        assert plan.product.wire_token == "fex"
        assert plan.eligibility.eligible is False
        assert plan.eligibility.coverage_tier == "level"
        assert plan.premium is not None
        assert plan.premium.cents == 2900
        assert plan.premium.mode == "monthly"
        # Legacy fields still populated for v0.4 consumers.
        assert plan.brand == "Colonial Penn"
        assert plan.monthly_premium == 29.0

    def test_synthesizes_v2_shape_from_zero_monthly_premium(self) -> None:
        body = json.dumps(
            {
                "plans": [
                    {
                        "brand": "Carrier X",
                        "tier": "level",
                        "product_token": "fex",
                        "monthly_premium": 0,
                    }
                ]
            }
        )

        result = parse_prequalify_response(body)

        plan = result.plans[0]
        assert plan.premium is not None
        assert plan.premium.cents == 0
        assert plan.premium.mode == "monthly"
        assert plan.brand == "Carrier X"
        assert plan.monthly_premium == 0

    def test_synthesizes_premium_when_nested_premium_is_empty(self) -> None:
        body = json.dumps(
            {
                "plans": [
                    {
                        "premium": {},
                        "monthly_premium": 10,
                    }
                ]
            }
        )

        result = parse_prequalify_response(body)

        plan = result.plans[0]
        assert plan.premium is not None
        assert plan.premium.cents == 1000
        assert plan.premium.mode == "monthly"

    def test_synthesizes_v2_shape_when_nested_objects_are_empty(self) -> None:
        body = json.dumps(
            {
                "plans": [
                    {
                        "carrier": {},
                        "product": {},
                        "eligibility": {},
                        "brand": "Carrier X",
                        "tier": "level",
                        "product_token": "fex",
                    }
                ]
            }
        )

        result = parse_prequalify_response(body)

        plan = result.plans[0]
        assert plan.carrier.name == "Carrier X"
        assert plan.product.wire_token == "fex"
        assert plan.eligibility.eligible is False
        assert plan.eligibility.coverage_tier == "level"

    def test_preserves_present_falsy_nested_values(self) -> None:
        body = json.dumps(
            {
                "plans": [
                    {
                        "carrier": {"name": ""},
                        "brand": "Carrier X",
                    }
                ]
            }
        )

        result = parse_prequalify_response(body)

        assert result.plans[0].carrier.name == ""

    def test_rejects_invalid_plan_entries(self) -> None:
        with pytest.raises(ValueError, match="plan entries"):
            parse_prequalify_response(json.dumps({"plans": [None]}))

    def test_default_construction_yields_empty_subobjects(self) -> None:
        plan = PrequalifyPlan()
        assert isinstance(plan.carrier, Carrier)
        assert isinstance(plan.product, PlanProduct)
        assert isinstance(plan.eligibility, Eligibility)
        # ``premium`` is optional — absence is meaningful (no offer).
        assert plan.premium is None

    def test_subobjects_are_frozen(self) -> None:
        premium = Premium(cents=100, display="$1.00", mode="monthly")
        try:
            premium.cents = 200  # type: ignore[misc]
        except (AttributeError, ValueError, TypeError):
            return
        msg = "Premium should be immutable"
        raise AssertionError(msg)
