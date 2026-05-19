"""Applicant domain model.

Mirrors ``packages/zyins/js/src/applicant.ts``. The TS surface uses
``Height`` and ``Weight`` factory classes to hide unit math; the Python
surface uses plain pydantic fields (``height_inches``, ``weight_pounds``)
because pydantic v2 makes invariant validation a one-liner and the
"factory hides multiplication-by-12" pattern is far less idiomatic in
Python than a validator.
"""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, field_validator


class Sex(str, Enum):
    """Applicant biological sex. Wire format uses ``M`` / ``F``."""

    MALE = "male"
    FEMALE = "female"


def sex_wire_code(sex: Sex) -> str:
    """Return the single-letter wire code (``'M'`` / ``'F'``)."""
    return "M" if sex is Sex.MALE else "F"


class NicotineUsage(str, Enum):
    """Applicant nicotine usage. Tri-state on the modern wire."""

    NONE = "none"
    CURRENT = "current"
    FORMER = "former"


class Medication(BaseModel):
    """A single medication on the applicant profile."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    name: str = Field(
        ..., description="Drug name as the applicant reports it (e.g. 'LOSARTAN')."
    )
    use: str = Field(..., description="Reason for use (e.g. 'HIGH BLOOD PRESSURE').")
    first_fill: str = Field(
        ..., description="Relative-date string (e.g. '11 MONTHS AGO')."
    )
    last_fill: str = Field(
        ..., description="Most recent fill date in the same relative format."
    )


class Condition(BaseModel):
    """A single medical condition on the applicant profile."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    name: str = Field(..., description="Condition name as the applicant reports it.")
    was_diagnosed: str = Field(..., description="Relative-date string of diagnosis.")
    last_treatment: str = Field(
        ..., description="Relative-date string of most recent treatment."
    )


class Applicant(BaseModel):
    """The applicant profile prequalify and quote operate on.

    All fields are required for a useful evaluation; the engine refuses
    requests that omit any of them, so they are non-optional at the
    model level (except ``zip``, ``medications``, ``conditions``).
    """

    model_config = ConfigDict(extra="forbid", frozen=True)

    dob: str = Field(
        ..., description="Date of birth as an ISO 8601 date (e.g. '1962-04-18')."
    )
    sex: Sex
    height_inches: int = Field(..., ge=12, le=108)
    weight_pounds: int = Field(..., ge=1, le=1500)
    state: str = Field(
        ..., min_length=2, max_length=2, description="Two-letter US state code."
    )
    zip: str | None = Field(
        default=None, description="ZIP code; required by some product families."
    )
    nicotine_use: NicotineUsage = NicotineUsage.NONE
    medications: tuple[Medication, ...] = Field(default_factory=tuple)
    conditions: tuple[Condition, ...] = Field(default_factory=tuple)

    @field_validator("state")
    @classmethod
    def _state_upper(cls, value: str) -> str:
        return value.upper()
