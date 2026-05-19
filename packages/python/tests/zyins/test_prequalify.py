"""Prequalify serialization + parsing tests."""

from __future__ import annotations

import json

import pytest

from sah_sdk.zyins import (
    Applicant,
    Condition,
    Coverage,
    Medication,
    NicotineUsage,
    PrequalifyInput,
    Sex,
)
from sah_sdk.zyins.prequalify import parse_prequalify_response
from sah_sdk.zyins.product import (
    Product,
    ProductSelection,
    ProductType,
)


def test_wire_body_uses_single_letter_sex_code() -> None:
    body = PrequalifyInput(
        applicant=Applicant(
            dob="1985-11-02",
            sex=Sex.FEMALE,
            height_inches=66,
            weight_pounds=140,
            state="CA",
            nicotine_use=NicotineUsage.NONE,
        ),
        coverage=Coverage.face_value(50_000),
        products="aetna.medicare-supplement",
    ).to_wire_body()
    parsed = json.loads(body)
    assert parsed["applicant"]["sex"] == "F"


def test_wire_body_includes_medications_and_conditions() -> None:
    body = PrequalifyInput(
        applicant=Applicant(
            dob="1962-04-18",
            sex=Sex.MALE,
            height_inches=70,
            weight_pounds=195,
            state="NC",
            nicotine_use=NicotineUsage.NONE,
            medications=(
                Medication(
                    name="LOSARTAN",
                    use="HIGH BLOOD PRESSURE",
                    first_fill="11 MONTHS AGO",
                    last_fill="3 MONTHS AGO",
                ),
            ),
            conditions=(
                Condition(
                    name="HBP",
                    was_diagnosed="3 YEARS AGO",
                    last_treatment="3 MONTHS AGO",
                ),
            ),
        ),
        coverage=Coverage.monthly_budget(50),
        products="colonial-penn.final-expense",
    ).to_wire_body()
    parsed = json.loads(body)
    assert parsed["applicant"]["medications"][0]["name"] == "LOSARTAN"
    assert parsed["applicant"]["conditions"][0]["name"] == "HBP"
    assert parsed["coverage"] == {"type": "monthly_budget", "amount": 50}


def test_product_selection_to_wire_string() -> None:
    sel = ProductSelection.many(
        [
            Product(
                brand="colonial-penn",
                type=ProductType.FINAL_EXPENSE,
                wire_token="colonial-penn.final-expense",
                display_name="Colonial Penn Final Expense",
            ),
            Product(
                brand="aetna",
                type=ProductType.MEDICARE_SUPPLEMENT,
                wire_token="aetna.medicare-supplement",
                display_name="Aetna Medicare Supplement",
            ),
        ]
    )
    assert (
        sel.to_wire_string() == "colonial-penn.final-expense|aetna.medicare-supplement"
    )


def test_empty_product_selection_rejected() -> None:
    with pytest.raises(ValueError):
        ProductSelection([])


def test_parse_response_lenient_on_missing_fields() -> None:
    result = parse_prequalify_response(
        '{"plans": [{"brand": "x"}], "request_id": "req_1"}'
    )
    assert result.request_id == "req_1"
    assert len(result.plans) == 1
    assert result.plans[0].brand == "x"
    # Missing fields default cleanly.
    assert result.plans[0].monthly_premium == 0.0


def test_coverage_factories_round() -> None:
    assert Coverage.face_value(100_000).amount == 100_000
    assert Coverage.monthly_budget(50).amount == 50
