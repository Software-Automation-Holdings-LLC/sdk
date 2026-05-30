"""Typed ``Height`` and ``Weight`` value objects.

Mirrors the TypeScript SDK's ``Height`` / ``Weight`` factory classes
(`packages/ts/src/zyins/applicant.ts`). The wire shape carries simple
integers (``height`` in inches, ``weight`` in pounds) but the SDK lets
the consumer build them from any unit so call sites read at the unit
the human knows: ``Height.from_feet_inches(5, 10)`` / ``Weight.from_kilograms(88)``.

The classes are immutable. Once constructed, ``.inches`` / ``.pounds``
expose the canonical wire integer; convenience accessors (``.cm``,
``.kilograms``) round-trip the value for display.

Pydantic compatibility: both classes implement ``__get_pydantic_core_schema__``
so they can appear directly on ``Applicant`` (post-rebrand). For now,
``Applicant.height_inches`` / ``Applicant.weight_pounds`` keep the integer
fields; consumers may build ``Height``/``Weight`` and call ``.inches`` /
``.pounds`` to populate them. A future major can switch the model fields
to these types directly without breaking the wire contract.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, ClassVar

_HEIGHT_FEET_INCHES_PATTERN: re.Pattern[str] = re.compile(
    r"""^\s*
        (?P<feet>\d+)         # feet
        \s*(?:'|ft|feet)\s*
        (?P<inches>\d+)?      # optional inches
        \s*(?:"|in|inches)?\s*
    $""",
    re.VERBOSE,
)
_HEIGHT_INCHES_PATTERN: re.Pattern[str] = re.compile(
    r"^\s*(?P<inches>\d+(?:\.\d+)?)\s*(?:in|inches|\")\s*$"
)
_HEIGHT_CM_PATTERN: re.Pattern[str] = re.compile(
    r"^\s*(?P<cm>\d+(?:\.\d+)?)\s*cm\s*$"
)
_WEIGHT_LBS_PATTERN: re.Pattern[str] = re.compile(
    r"^\s*(?P<lbs>\d+(?:\.\d+)?)\s*(?:lb|lbs|pounds?)\s*$"
)
_WEIGHT_KG_PATTERN: re.Pattern[str] = re.compile(
    r"^\s*(?P<kg>\d+(?:\.\d+)?)\s*(?:kg|kilograms?)\s*$"
)

_INCHES_PER_FOOT: int = 12
_CM_PER_INCH: float = 2.54
_KG_PER_LB: float = 0.45359237

_HEIGHT_MIN_INCHES: int = 12
_HEIGHT_MAX_INCHES: int = 108
_WEIGHT_MIN_POUNDS: int = 1
_WEIGHT_MAX_POUNDS: int = 1500


class HeightParseError(ValueError):
    """Raised when ``Height.from_string`` cannot interpret the input."""


class WeightParseError(ValueError):
    """Raised when ``Weight.from_string`` cannot interpret the input."""


@dataclass(frozen=True, slots=True)
class Height:
    """An applicant height. Wire format: integer inches.

    Construct via factories (``from_inches``, ``from_feet_inches``,
    ``from_cm``, ``from_string``) — the bare constructor takes the
    canonical integer-inches value if you have one already.
    """

    inches: int

    MIN_INCHES: ClassVar[int] = _HEIGHT_MIN_INCHES
    MAX_INCHES: ClassVar[int] = _HEIGHT_MAX_INCHES

    def __post_init__(self) -> None:
        if not isinstance(self.inches, int) or isinstance(self.inches, bool):
            raise TypeError(
                f"Height.inches must be int, got {type(self.inches).__name__}"
            )
        if self.inches < _HEIGHT_MIN_INCHES or self.inches > _HEIGHT_MAX_INCHES:
            raise ValueError(
                f"Height.inches must be in [{_HEIGHT_MIN_INCHES}, "
                f"{_HEIGHT_MAX_INCHES}]; got {self.inches}"
            )

    @classmethod
    def from_inches(cls, inches: int) -> Height:
        """Construct from a total-inches integer."""
        return cls(inches=int(inches))

    @classmethod
    def from_feet_inches(cls, feet: int, inches: int = 0) -> Height:
        """Construct from feet and inches (e.g. ``Height.from_feet_inches(5, 10)``)."""
        if feet < 0 or inches < 0:
            raise ValueError(
                f"Height.from_feet_inches requires non-negative components; "
                f"got feet={feet}, inches={inches}"
            )
        return cls(inches=feet * _INCHES_PER_FOOT + inches)

    @classmethod
    def from_cm(cls, cm: float) -> Height:
        """Construct from centimeters; rounds to nearest inch for the wire."""
        if cm <= 0:
            raise ValueError(f"Height.from_cm requires positive cm; got {cm}")
        return cls(inches=round(cm / _CM_PER_INCH))

    @classmethod
    def from_string(cls, value: str) -> Height:
        """Parse common representations: ``5'10"``, ``70 in``, ``178 cm``."""
        text = value.strip()
        if not text:
            raise HeightParseError("Height.from_string: empty input")
        cm_match = _HEIGHT_CM_PATTERN.match(text)
        if cm_match is not None:
            try:
                return cls.from_cm(float(cm_match.group("cm")))
            except ValueError as exc:
                raise HeightParseError(str(exc)) from exc
        in_match = _HEIGHT_INCHES_PATTERN.match(text)
        if in_match is not None:
            try:
                return cls(inches=round(float(in_match.group("inches"))))
            except ValueError as exc:
                raise HeightParseError(str(exc)) from exc
        ft_match = _HEIGHT_FEET_INCHES_PATTERN.match(text)
        if ft_match is not None and ft_match.group("feet") is not None:
            feet = int(ft_match.group("feet"))
            inches = int(ft_match.group("inches") or 0)
            try:
                return cls.from_feet_inches(feet, inches)
            except ValueError as exc:
                raise HeightParseError(str(exc)) from exc
        raise HeightParseError(
            f"Height.from_string: cannot parse {value!r}. "
            "Try \"5'10\\\"\", '70 in', or '178 cm'."
        )

    @property
    def cm(self) -> float:
        """Return the height in centimeters (lossy round-trip)."""
        return self.inches * _CM_PER_INCH

    @property
    def feet_and_inches(self) -> tuple[int, int]:
        """Return ``(feet, remaining_inches)`` for display."""
        return divmod(self.inches, _INCHES_PER_FOOT)

    def __str__(self) -> str:
        feet, remainder = self.feet_and_inches
        return f"{feet}'{remainder}\""

    @classmethod
    def __get_pydantic_core_schema__(
        cls, _source_type: Any, _handler: Any
    ) -> Any:
        # Imported lazily so ``measurements`` doesn't pull pydantic at
        # import time for non-validating consumers.
        from pydantic_core import core_schema

        def _validate(value: Any) -> Height:
            if isinstance(value, Height):
                return value
            if isinstance(value, int) and not isinstance(value, bool):
                return cls.from_inches(value)
            if isinstance(value, str):
                return cls.from_string(value)
            raise ValueError(
                f"Height accepts Height | int | str; got {type(value).__name__}"
            )

        return core_schema.no_info_plain_validator_function(
            _validate,
            serialization=core_schema.plain_serializer_function_ser_schema(
                lambda h: h.inches, return_schema=core_schema.int_schema()
            ),
        )


@dataclass(frozen=True, slots=True)
class Weight:
    """An applicant weight. Wire format: integer pounds."""

    pounds: int

    MIN_POUNDS: ClassVar[int] = _WEIGHT_MIN_POUNDS
    MAX_POUNDS: ClassVar[int] = _WEIGHT_MAX_POUNDS

    def __post_init__(self) -> None:
        if not isinstance(self.pounds, int) or isinstance(self.pounds, bool):
            raise TypeError(
                f"Weight.pounds must be int, got {type(self.pounds).__name__}"
            )
        if self.pounds < _WEIGHT_MIN_POUNDS or self.pounds > _WEIGHT_MAX_POUNDS:
            raise ValueError(
                f"Weight.pounds must be in [{_WEIGHT_MIN_POUNDS}, "
                f"{_WEIGHT_MAX_POUNDS}]; got {self.pounds}"
            )

    @classmethod
    def from_pounds(cls, pounds: int) -> Weight:
        """Construct from pounds (the canonical wire unit)."""
        return cls(pounds=int(pounds))

    @classmethod
    def from_kilograms(cls, kg: float) -> Weight:
        """Construct from kilograms; rounds to nearest pound for the wire."""
        if kg <= 0:
            raise ValueError(f"Weight.from_kilograms requires positive kg; got {kg}")
        return cls(pounds=round(kg / _KG_PER_LB))

    @classmethod
    def from_string(cls, value: str) -> Weight:
        """Parse common representations: ``195 lbs``, ``88.5 kg``."""
        text = value.strip()
        if not text:
            raise WeightParseError("Weight.from_string: empty input")
        kg_match = _WEIGHT_KG_PATTERN.match(text)
        if kg_match is not None:
            try:
                return cls.from_kilograms(float(kg_match.group("kg")))
            except ValueError as exc:
                raise WeightParseError(str(exc)) from exc
        lb_match = _WEIGHT_LBS_PATTERN.match(text)
        if lb_match is not None:
            try:
                return cls(pounds=round(float(lb_match.group("lbs"))))
            except ValueError as exc:
                raise WeightParseError(str(exc)) from exc
        raise WeightParseError(
            f"Weight.from_string: cannot parse {value!r}. "
            "Try '195 lbs' or '88.5 kg'."
        )

    @property
    def kilograms(self) -> float:
        """Return the weight in kilograms (lossy round-trip)."""
        return self.pounds * _KG_PER_LB

    def __str__(self) -> str:
        return f"{self.pounds} lb"

    @classmethod
    def __get_pydantic_core_schema__(
        cls, _source_type: Any, _handler: Any
    ) -> Any:
        from pydantic_core import core_schema

        def _validate(value: Any) -> Weight:
            if isinstance(value, Weight):
                return value
            if isinstance(value, int) and not isinstance(value, bool):
                return cls.from_pounds(value)
            if isinstance(value, str):
                return cls.from_string(value)
            raise ValueError(
                f"Weight accepts Weight | int | str; got {type(value).__name__}"
            )

        return core_schema.no_info_plain_validator_function(
            _validate,
            serialization=core_schema.plain_serializer_function_ser_schema(
                lambda w: w.pounds, return_schema=core_schema.int_schema()
            ),
        )


__all__ = [
    "Height",
    "HeightParseError",
    "Weight",
    "WeightParseError",
]
