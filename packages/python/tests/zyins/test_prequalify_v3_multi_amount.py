"""Multi-amount ``POST /v3/prequalify`` — native ``coverage.quote_options``
request + flat ``plans[]`` response with the v3 Money primitive (zyins
#400, Money cutover).

Every v3 request — single and multi-amount alike — answers with one flat
``plans[]`` array. A single face amount keeps the proven
``{face_amount_cents}`` coverage; a multi-amount probe sends
``coverage.quote_options`` (mirroring ``/v3/quote``). Group client-side
with :func:`by_amount` on the requested dimension.
"""

from __future__ import annotations

import json

from sah_sdk.zyins.applicant import (
    Applicant,
    NicotineDuration,
    NicotineUsageInput,
    Sex,
)
from sah_sdk.zyins.coverage import Coverage
from sah_sdk.zyins.prequalify_v3 import (
    by_amount,
    parse_prequalify_v3_envelope,
    serialize_v3_prequalify_body,
)
from sah_sdk.zyins.product import Product, ProductSelection, ProductType


def _applicant() -> Applicant:
    return Applicant(
        dob="1962-04-18",
        sex=Sex.MALE,
        height_inches=70,
        weight_pounds=195,
        state="NC",
        nicotine_use=NicotineUsageInput(last_used=NicotineDuration.NEVER),
    )


def _products() -> ProductSelection:
    return ProductSelection.of(
        Product(
            brand="aetna-accendo",
            type=ProductType.FINAL_EXPENSE,
            wire_token="fex",
            display_name="Final Expense",
        )
    )


def _face_offer(amount_cents: int, display: str, premium_cents: int) -> dict:
    return {
        "object": "plan_offer",
        "id": f"p{amount_cents}",
        "eligible": True,
        "plan_info": [],
        "metadata": {},
        "death_benefit": {"amount": {"cents": amount_cents, "display": display}, "period": None},
        "pricing": [
            {
                "rate_class": "Preferred",
                "primary": True,
                "eligibility": {"category": "immediate", "eligible": True, "reasons": []},
                "premium": {
                    "amount": {"cents": premium_cents, "display": f"${premium_cents / 100:.2f}"},
                    "default_mode": "MONTHLY-EFT",
                    "modes": {
                        "MONTHLY-EFT": {
                            "cents": premium_cents,
                            "display": f"${premium_cents / 100:.2f}",
                        },
                    },
                },
                "rank": 1,
            }
        ],
    }


def _budget_offer(budget_cents: int, display: str) -> dict:
    offer = _face_offer(5_000_000, "$50,000", 4_500)
    offer["budget"] = {"amount": {"cents": budget_cents, "display": display}, "period": "monthly"}
    return offer


_FLAT_FACE_RESPONSE = json.dumps(
    {
        "object": "prequalify_result",
        "request_id": "req_01HZK2N5GQR9T8X4B6FJW3Y1AS",
        "idempotency_key": "550e8400-e29b-41d4-a716-446655440000",
        "livemode": True,
        "data": {"plans": [_face_offer(2_500_000, "$25,000", 4_500), _face_offer(5_000_000, "$50,000", 8_100)]},
    }
)

_FLAT_BUDGET_RESPONSE = json.dumps(
    {
        "object": "prequalify_result",
        "request_id": "r",
        "idempotency_key": "k",
        "livemode": True,
        "data": {"plans": [_budget_offer(5_000, "$50.00"), _budget_offer(7_500, "$75.00")]},
    }
)

_EMPTY_RESPONSE = json.dumps(
    {
        "object": "prequalify_result",
        "request_id": "req_01HZK2N5GQR9T8X4B6FJW3Y1AS",
        "idempotency_key": "550e8400-e29b-41d4-a716-446655440000",
        "livemode": True,
        "data": {"plans": []},
    }
)


def test_multi_face_values_emit_quote_options_not_face_amount_cents() -> None:
    body = serialize_v3_prequalify_body(
        applicant=_applicant(),
        coverage=Coverage.face_values([25_000, 50_000]),
        products=_products(),
    )
    coverage = json.loads(body)["coverage"]
    assert "face_amount_cents" not in coverage
    assert coverage["state"] == "NC"
    assert coverage["quote_options"] == {
        "quote_type": "face_amounts",
        "amounts": ["25000", "50000"],
    }


def test_multi_monthly_budgets_emit_monthly_budget_quote_type() -> None:
    body = serialize_v3_prequalify_body(
        applicant=_applicant(),
        coverage=Coverage.monthly_budgets([50, 75]),
        products=_products(),
    )
    coverage = json.loads(body)["coverage"]
    assert coverage["quote_options"] == {
        "quote_type": "monthly_budget",
        "amounts": ["50", "75"],
    }


def test_flat_face_response_parses_money_typed_death_benefit() -> None:
    result = parse_prequalify_v3_envelope(_FLAT_FACE_RESPONSE)
    assert len(result.plans) == 2
    assert result.plans[0].death_benefit is not None
    assert result.plans[0].death_benefit.amount.cents == 2_500_000
    assert result.plans[0].death_benefit.amount.display == "$25,000"
    assert result.plans[0].death_benefit.period is None
    assert result.plans[0].budget is None
    assert result.plans[1].pricing[0].premium is not None
    assert result.plans[1].pricing[0].premium.amount.cents == 8_100


def test_by_amount_groups_face_response_by_death_benefit() -> None:
    result = parse_prequalify_v3_envelope(_FLAT_FACE_RESPONSE)
    grouped = by_amount(result.plans)
    assert list(grouped.keys()) == [2_500_000, 5_000_000]
    assert len(grouped[2_500_000]) == 1
    assert len(grouped[5_000_000]) == 1


def test_budget_response_decodes_budget_and_groups_by_budget() -> None:
    result = parse_prequalify_v3_envelope(_FLAT_BUDGET_RESPONSE)
    assert result.plans[0].budget is not None
    assert result.plans[0].budget.amount.cents == 5_000
    assert result.plans[0].budget.period == "monthly"
    grouped = by_amount(result.plans)
    assert list(grouped.keys()) == [5_000, 7_500]


def test_empty_flat_response_parses_no_plans() -> None:
    result = parse_prequalify_v3_envelope(_EMPTY_RESPONSE)
    assert result.plans == ()


def test_by_amount_skips_offers_missing_budget_in_budget_mode() -> None:
    """When any offer has budget (budget mode), missing budget is skipped."""
    # One offer with budget, one without — the second is skipped.
    mixed_response = json.dumps(
        {
            "object": "prequalify_result",
            "request_id": "r",
            "idempotency_key": "k",
            "livemode": True,
            "data": {
                "plans": [
                    _budget_offer(5_000, "$50.00"),
                    _face_offer(2_500_000, "$25,000", 4_500),  # No budget field.
                ]
            },
        }
    )
    result = parse_prequalify_v3_envelope(mixed_response)
    grouped = by_amount(result.plans)
    # Only the budget offer should be grouped; the face-only offer is skipped.
    assert list(grouped.keys()) == [5_000]
    assert len(grouped[5_000]) == 1
