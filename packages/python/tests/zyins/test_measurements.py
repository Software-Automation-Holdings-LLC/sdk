"""Tests for the Height / Weight value objects."""

from __future__ import annotations

import pytest
from pydantic import BaseModel, ValidationError

from sah_sdk.zyins.measurements import (
    Height,
    HeightParseError,
    Weight,
    WeightParseError,
)


class _MeasurementModel(BaseModel):
    height: Height
    weight: Weight


class TestHeightFromFeetInches:
    def test_returns_total_inches_for_five_foot_ten(self) -> None:
        assert Height.from_feet_inches(5, 10).inches == 70

    def test_zero_inches_defaults(self) -> None:
        assert Height.from_feet_inches(6).inches == 72

    def test_rejects_negative_components(self) -> None:
        with pytest.raises(ValueError, match="non-negative"):
            Height.from_feet_inches(-1, 0)


class TestHeightFromCm:
    def test_rounds_to_nearest_inch(self) -> None:
        assert Height.from_cm(178).inches == 70

    def test_rejects_zero(self) -> None:
        with pytest.raises(ValueError, match="positive"):
            Height.from_cm(0)


class TestHeightFromString:
    @pytest.mark.parametrize(
        ("value", "expected_inches"),
        [
            ("5'10\"", 70),
            ("5'10", 70),
            ("6'0\"", 72),
            ("70 in", 70),
            ("178 cm", 70),
        ],
    )
    def test_parses_supported_forms(self, value: str, expected_inches: int) -> None:
        assert Height.from_string(value).inches == expected_inches

    def test_rejects_garbage(self) -> None:
        with pytest.raises(HeightParseError):
            Height.from_string("about six feet")

    def test_rejects_empty(self) -> None:
        with pytest.raises(HeightParseError):
            Height.from_string("   ")

    def test_rejects_bare_digits_as_parse_error(self) -> None:
        with pytest.raises(HeightParseError):
            Height.from_string("70")

    def test_rejects_out_of_range_as_parse_error(self) -> None:
        with pytest.raises(HeightParseError):
            Height.from_string("13 ft")


class TestHeightProperties:
    def test_feet_and_inches_split(self) -> None:
        assert Height.from_inches(70).feet_and_inches == (5, 10)

    def test_cm_round_trip(self) -> None:
        assert Height.from_inches(70).cm == pytest.approx(177.8)

    def test_str_format(self) -> None:
        assert str(Height.from_inches(70)) == "5'10\""


class TestHeightInvariants:
    def test_rejects_below_minimum(self) -> None:
        with pytest.raises(ValueError, match=r"\[12, 108\]"):
            Height(inches=5)

    def test_rejects_above_maximum(self) -> None:
        with pytest.raises(ValueError, match=r"\[12, 108\]"):
            Height(inches=200)


class TestWeightFromPounds:
    def test_passes_through_pounds(self) -> None:
        assert Weight.from_pounds(195).pounds == 195


class TestWeightFromKilograms:
    def test_rounds_to_nearest_pound(self) -> None:
        assert Weight.from_kilograms(88.45).pounds == 195

    def test_rejects_zero(self) -> None:
        with pytest.raises(ValueError, match="positive"):
            Weight.from_kilograms(0)


class TestWeightFromString:
    @pytest.mark.parametrize(
        ("value", "expected_pounds"),
        [
            ("195 lbs", 195),
            ("195 lb", 195),
            ("195 pounds", 195),
            ("88.45 kg", 195),
        ],
    )
    def test_parses_supported_forms(self, value: str, expected_pounds: int) -> None:
        assert Weight.from_string(value).pounds == expected_pounds

    def test_rejects_garbage(self) -> None:
        with pytest.raises(WeightParseError):
            Weight.from_string("a brick")

    def test_rejects_out_of_range_as_parse_error(self) -> None:
        with pytest.raises(WeightParseError):
            Weight.from_string("2000 lbs")


class TestWeightProperties:
    def test_kilograms_round_trip(self) -> None:
        assert Weight.from_pounds(195).kilograms == pytest.approx(88.45, abs=0.01)

    def test_str_format(self) -> None:
        assert str(Weight.from_pounds(195)) == "195 lb"


class TestWeightInvariants:
    def test_rejects_below_minimum(self) -> None:
        with pytest.raises(ValueError, match=r"\[1, 1500\]"):
            Weight(pounds=0)

    def test_rejects_above_maximum(self) -> None:
        with pytest.raises(ValueError, match=r"\[1, 1500\]"):
            Weight(pounds=2000)


class TestImmutability:
    def test_height_is_frozen(self) -> None:
        h = Height.from_inches(70)
        with pytest.raises(AttributeError):
            h.inches = 71  # type: ignore[misc]

    def test_weight_is_frozen(self) -> None:
        w = Weight.from_pounds(195)
        with pytest.raises(AttributeError):
            w.pounds = 200  # type: ignore[misc]


class TestMeasurementPydanticIntegration:
    def test_height_weight_pydantic_schema_accepts_supported_inputs(self) -> None:
        model = _MeasurementModel(height="5'10\"", weight="88.45 kg")

        assert model.height.inches == 70
        assert model.weight.pounds == 195
        assert model.model_dump() == {"height": 70, "weight": 195}

    def test_height_weight_pydantic_schema_rejects_invalid_inputs(self) -> None:
        with pytest.raises(ValidationError):
            _MeasurementModel(height="not tall", weight=object())
