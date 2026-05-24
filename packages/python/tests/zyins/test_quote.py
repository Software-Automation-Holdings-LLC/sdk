"""Quote serialization + parsing tests."""

from __future__ import annotations

import json

from sah_sdk.zyins import (
    Applicant,
    Coverage,
    NicotineDuration,
    NicotineProductUsage,
    NicotineUsage,
    NicotineUsageInput,
    QuoteInput,
    Sex,
)
from sah_sdk.zyins.quote import parse_quote_response


def test_wire_body_emits_canonical_sex_string() -> None:
    body = QuoteInput(
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
    # quote uses applicant_to_wire_dict which emits canonical 'female'/'male'.
    assert parsed["applicant"]["sex"] == "female"


def test_wire_body_preserves_nicotine_product_usage() -> None:
    body = QuoteInput(
        applicant=Applicant(
            dob="1985-11-02",
            sex=Sex.FEMALE,
            height_inches=66,
            weight_pounds=140,
            state="CA",
            nicotine_use=NicotineUsageInput(
                last_used=NicotineDuration.WITHIN_12_MONTHS,
                product_usage=(NicotineProductUsage(type="CIGARETTE", frequency="DAILY"),),
            ),
        ),
        coverage=Coverage.face_value(50_000),
        products="aetna.medicare-supplement",
    ).to_wire_body()
    parsed = json.loads(body)
    assert parsed["applicant"]["nicotine_use"] == {
        "last_used": "within_12_months",
        "product_usage": [{"type": "CIGARETTE", "frequency": "DAILY"}],
    }


def test_parse_quote_response_tolerates_non_object_root() -> None:
    result = parse_quote_response("[]")
    assert result.plans == ()
    assert result.request_id == ""
