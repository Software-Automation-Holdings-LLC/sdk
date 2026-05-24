"""Prequalify 0.5.1 flat wire serialization + parsing tests."""

from __future__ import annotations

import json

import pytest

from sah_sdk.zyins import (
    Applicant,
    Condition,
    Coverage,
    Medication,
    NicotineDuration,
    NicotineProductUsage,
    NicotineUsage,
    NicotineUsageInput,
    PrequalifyInput,
    Sex,
)
from sah_sdk.zyins.coverage import QuoteType
from sah_sdk.zyins.prequalify import parse_prequalify_response
from sah_sdk.zyins.product import (
    Product,
    ProductCatalog,
    ProductSelection,
    ProductType,
)

# ---------------------------------------------------------------------------
# John Doe canonical persona (NC, no nicotine, no conditions/medications)
# ---------------------------------------------------------------------------


def _john_doe_nc() -> Applicant:
    return Applicant(
        dob="1962-04-18",
        sex=Sex.MALE,
        height_inches=70,
        weight_pounds=195,
        state="NC",
        nicotine_use=NicotineUsageInput(last_used=NicotineDuration.NEVER),
    )


# ---------------------------------------------------------------------------
# Flat wire shape tests
# ---------------------------------------------------------------------------


def test_wire_body_flat_top_level_keys() -> None:
    """The 0.5.1 wire body has no applicant/coverage nesting at the root."""
    body = PrequalifyInput(
        applicant=_john_doe_nc(),
        coverage=Coverage.face_value(25_000),
        products="senior-life",
    ).to_wire_body()
    parsed = json.loads(body)

    # Top-level keys must be flat — no nesting.
    assert "date_of_birth" in parsed
    assert "gender" in parsed
    assert "height" in parsed
    assert "weight" in parsed
    assert "state" in parsed
    assert "nicotine_usage" in parsed
    assert "products" in parsed
    assert "quote_options" in parsed

    # Old nesting must not be present.
    assert "applicant" not in parsed
    assert "coverage" not in parsed


def test_wire_body_emits_canonical_sex_string() -> None:
    """gender field emits 'male'/'female' directly, not 'M'/'F'."""
    male_body = json.loads(
        PrequalifyInput(
            applicant=_john_doe_nc(),
            coverage=Coverage.face_value(25_000),
            products="senior-life",
        ).to_wire_body()
    )
    assert male_body["gender"] == "male"

    female_body = json.loads(
        PrequalifyInput(
            applicant=Applicant(
                dob="1985-11-02",
                sex=Sex.FEMALE,
                height_inches=66,
                weight_pounds=140,
                state="CA",
                nicotine_use=NicotineUsageInput(last_used=NicotineDuration.NEVER),
            ),
            coverage=Coverage.face_value(50_000),
            products="aetna.medicare-supplement",
        ).to_wire_body()
    )
    assert female_body["gender"] == "female"


def test_wire_body_john_doe_nc_canonical() -> None:
    """John Doe NC persona produces the exact expected flat wire body."""
    body = PrequalifyInput(
        applicant=_john_doe_nc(),
        coverage=Coverage.face_value(25_000),
        products="senior-life",
    ).to_wire_body()
    parsed = json.loads(body)

    assert parsed["date_of_birth"] == "1962-04-18"
    assert parsed["gender"] == "male"
    assert parsed["height"] == 70
    assert parsed["weight"] == 195
    assert parsed["state"] == "NC"
    assert parsed["nicotine_usage"]["last_used"] == "never"
    assert parsed["products"] == ["senior-life"]
    assert parsed["quote_options"]["amounts"] == ["25000"]
    assert parsed["quote_options"]["quote_type"] == "face_amounts"
    assert parsed["conditions"] == []
    assert parsed["medications"] == []


def test_wire_body_products_is_array() -> None:
    """products field must be a JSON array, never a pipe-joined string."""
    sel = ProductSelection.many(
        [
            Product(
                brand="cp", type=ProductType.FINAL_EXPENSE, wire_token="cp.fex", display_name="CP"
            ),
            Product(
                brand="moo",
                type=ProductType.FINAL_EXPENSE,
                wire_token="moo.fex",
                display_name="MOO",
            ),
        ]
    )
    parsed = json.loads(
        PrequalifyInput(
            applicant=_john_doe_nc(),
            coverage=Coverage.face_value(10_000),
            products=sel,
        ).to_wire_body()
    )
    assert parsed["products"] == ["cp.fex", "moo.fex"]


def test_wire_body_splits_legacy_pipe_product_string() -> None:
    parsed = json.loads(
        PrequalifyInput(
            applicant=_john_doe_nc(),
            coverage=Coverage.face_value(10_000),
            products="cp.fex|moo.fex",
        ).to_wire_body()
    )
    assert parsed["products"] == ["cp.fex", "moo.fex"]


def test_wire_body_omits_empty_legacy_pipe_products() -> None:
    parsed = json.loads(
        PrequalifyInput(
            applicant=_john_doe_nc(),
            coverage=Coverage.face_value(10_000),
            products="|cp.fex||moo.fex|",
        ).to_wire_body()
    )
    assert parsed["products"] == ["cp.fex", "moo.fex"]


def test_wire_body_monthly_budget_quote_type() -> None:
    parsed = json.loads(
        PrequalifyInput(
            applicant=_john_doe_nc(),
            coverage=Coverage.monthly_budget(50),
            products="cp.fex",
        ).to_wire_body()
    )
    assert parsed["quote_options"]["quote_type"] == "monthly_budget"
    assert parsed["quote_options"]["amounts"] == ["50"]


def test_wire_body_nicotine_structured_input() -> None:
    applicant = Applicant(
        dob="1985-11-02",
        sex=Sex.FEMALE,
        height_inches=66,
        weight_pounds=140,
        state="CA",
        nicotine_use=NicotineUsageInput(
            last_used=NicotineDuration.WITHIN_12_MONTHS,
            product_usage=(),
        ),
    )
    parsed = json.loads(
        PrequalifyInput(
            applicant=applicant,
            coverage=Coverage.face_value(50_000),
            products="cp.fex",
        ).to_wire_body()
    )
    assert parsed["nicotine_usage"]["last_used"] == "within_12_months"


def test_wire_body_nicotine_product_usage() -> None:
    applicant = Applicant(
        dob="1985-11-02",
        sex=Sex.FEMALE,
        height_inches=66,
        weight_pounds=140,
        state="CA",
        nicotine_use=NicotineUsageInput(
            last_used=NicotineDuration.WITHIN_12_MONTHS,
            product_usage=(NicotineProductUsage(type="CIGARETTE", frequency="DAILY"),),
        ),
    )
    parsed = json.loads(
        PrequalifyInput(
            applicant=applicant,
            coverage=Coverage.face_value(50_000),
            products="cp.fex",
        ).to_wire_body()
    )
    assert parsed["nicotine_usage"]["product_usage"] == [
        {"type": "CIGARETTE", "frequency": "DAILY"}
    ]


def test_wire_body_nicotine_legacy_enum_maps() -> None:
    """Deprecated NicotineUsage enum still maps to the nearest duration."""
    for legacy, expected_last_used in [
        (NicotineUsage.NONE, "never"),
        (NicotineUsage.CURRENT, "within_12_months"),
        (NicotineUsage.FORMER, "12_to_24_months"),
    ]:
        applicant = Applicant(
            dob="1962-04-18",
            sex=Sex.MALE,
            height_inches=70,
            weight_pounds=195,
            state="NC",
            nicotine_use=legacy,
        )
        parsed = json.loads(
            PrequalifyInput(
                applicant=applicant,
                coverage=Coverage.face_value(25_000),
                products="senior-life",
            ).to_wire_body()
        )
        assert parsed["nicotine_usage"]["last_used"] == expected_last_used


def test_wire_body_includes_medications_and_conditions() -> None:
    applicant = Applicant(
        dob="1962-04-18",
        sex=Sex.MALE,
        height_inches=70,
        weight_pounds=195,
        state="NC",
        nicotine_use=NicotineUsageInput(last_used=NicotineDuration.NEVER),
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
    )
    parsed = json.loads(
        PrequalifyInput(
            applicant=applicant,
            coverage=Coverage.monthly_budget(50),
            products="colonial-penn.final-expense",
        ).to_wire_body()
    )
    assert parsed["medications"][0]["name"] == "LOSARTAN"
    assert parsed["conditions"][0]["name"] == "HBP"
    # These must be top-level, not nested under applicant.
    assert "applicant" not in parsed


def test_wire_body_zip_omitted_when_none() -> None:
    parsed = json.loads(
        PrequalifyInput(
            applicant=_john_doe_nc(),
            coverage=Coverage.face_value(25_000),
            products="senior-life",
        ).to_wire_body()
    )
    assert "zip" not in parsed


def test_wire_body_zip_included_when_set() -> None:
    applicant = Applicant(
        dob="1962-04-18",
        sex=Sex.MALE,
        height_inches=70,
        weight_pounds=195,
        state="NC",
        zip="27601",
        nicotine_use=NicotineUsageInput(last_used=NicotineDuration.NEVER),
    )
    parsed = json.loads(
        PrequalifyInput(
            applicant=applicant,
            coverage=Coverage.face_value(25_000),
            products="senior-life",
        ).to_wire_body()
    )
    assert parsed["zip"] == "27601"


# ---------------------------------------------------------------------------
# NicotineDuration enum values
# ---------------------------------------------------------------------------


def test_nicotine_duration_values() -> None:
    assert NicotineDuration.NEVER.value == "never"
    assert NicotineDuration.WITHIN_12_MONTHS.value == "within_12_months"
    assert NicotineDuration.N12_TO_24_MONTHS.value == "12_to_24_months"
    assert NicotineDuration.N24_TO_36_MONTHS.value == "24_to_36_months"
    assert NicotineDuration.N36_TO_48_MONTHS.value == "36_to_48_months"
    assert NicotineDuration.N48_TO_60_MONTHS.value == "48_to_60_months"
    assert NicotineDuration.OVER_60_MONTHS.value == "over_60_months"


# ---------------------------------------------------------------------------
# QuoteType enum values
# ---------------------------------------------------------------------------


def test_quote_type_values() -> None:
    assert QuoteType.FACE_AMOUNTS.value == "face_amounts"
    assert QuoteType.MONTHLY_BUDGET.value == "monthly_budget"


# ---------------------------------------------------------------------------
# ProductCatalog
# ---------------------------------------------------------------------------


def test_product_catalog_from_datasets_parses_entries() -> None:
    bundle = {
        "products": {
            "fex": [
                {
                    "identifier": "fex-cp",
                    "carrier": "colonial-penn",
                    "name": "CP FEX",
                    "product": "fex",
                },
            ]
        }
    }
    catalog = ProductCatalog.from_datasets(bundle)
    p = catalog.find_by_slug("fex-cp")
    assert p.brand == "colonial-penn"
    assert p.wire_token == "fex-cp"
    assert p.display_name == "CP FEX"


def test_product_catalog_default_is_callable() -> None:
    assert (
        ProductCatalog.default().find_by_slug("colonial-penn.final-expense").brand
        == "colonial-penn"
    )


def test_product_catalog_find_by_slug_raises_on_miss() -> None:
    catalog = ProductCatalog.from_datasets({"products": {}})
    with pytest.raises(KeyError):
        catalog.find_by_slug("nonexistent")


def test_product_catalog_try_find_by_slug_returns_none_on_miss() -> None:
    catalog = ProductCatalog.from_datasets({"products": {}})
    assert catalog.try_find_by_slug("nonexistent") is None


def test_product_catalog_from_datasets_skips_bad_entries() -> None:
    bundle = {
        "products": {
            "fex": [
                {"identifier": "ok", "carrier": "x", "name": "X", "product": "fex"},
                {"identifier": "bad", "carrier": "x", "name": "X", "product": None},
                {"missing": "fields"},
                None,
            ]
        }
    }
    catalog = ProductCatalog.from_datasets(bundle)
    assert len(catalog.list()) == 1


# ---------------------------------------------------------------------------
# ProductSelection.to_wire_array (replaces to_wire_string)
# ---------------------------------------------------------------------------


def test_product_selection_to_wire_array() -> None:
    sel = ProductSelection.many(
        [
            Product(
                brand="cp", type=ProductType.FINAL_EXPENSE, wire_token="cp.fex", display_name="CP"
            ),
            Product(
                brand="moo",
                type=ProductType.FINAL_EXPENSE,
                wire_token="moo.fex",
                display_name="MOO",
            ),
        ]
    )
    assert sel.to_wire_array() == ("cp.fex", "moo.fex")


def test_empty_product_selection_rejected() -> None:
    with pytest.raises(ValueError):
        ProductSelection([])


# ---------------------------------------------------------------------------
# Response parsing
# ---------------------------------------------------------------------------


def test_parse_response_lenient_on_missing_fields() -> None:
    result = parse_prequalify_response('{"plans": [{"brand": "x"}], "request_id": "req_1"}')
    assert result.request_id == "req_1"
    assert len(result.plans) == 1
    assert result.plans[0].brand == "x"
    assert result.plans[0].monthly_premium == 0.0


def test_coverage_factories_round() -> None:
    assert Coverage.face_value(100_000).amount == 100_000
    assert Coverage.monthly_budget(50).amount == 50
