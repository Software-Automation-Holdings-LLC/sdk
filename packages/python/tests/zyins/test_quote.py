"""Quote serialization + parsing tests."""

from __future__ import annotations

import json

from sah_sdk.zyins import Applicant, Coverage, NicotineUsage, QuoteInput, Sex
from sah_sdk.zyins.quote import parse_quote_response


def test_wire_body_uses_single_letter_sex_code() -> None:
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
    assert parsed["applicant"]["sex"] == "F"


def test_parse_quote_response_tolerates_non_object_root() -> None:
    result = parse_quote_response("[]")
    assert result.plans == ()
    assert result.request_id == ""
