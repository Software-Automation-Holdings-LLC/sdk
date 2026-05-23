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

from sah_sdk.catalog.states import State


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
    state: State | str = Field(
        ...,
        min_length=2,
        max_length=2,
        description=(
            "ISO 3166-2:US two-letter postal code. Prefer the typed catalog "
            "enum (``catalog.State.NorthCarolina``) — idiotproof against "
            "typos like ``'North Carolina'``. Raw two-letter strings "
            "(``'NC'``) remain accepted for backward compatibility."
        ),
    )
    zip: str | None = Field(
        default=None, description="ZIP code; required by some product families."
    )
    nicotine_use: NicotineUsage = NicotineUsage.NONE
    medications: tuple[Medication, ...] = Field(default_factory=tuple)
    conditions: tuple[Condition, ...] = Field(default_factory=tuple)

    @field_validator("state")
    @classmethod
    def _state_upper(cls, value: State | str) -> str:
        # State is a StrEnum (str, Enum); calling .upper() on either form
        # produces the canonical wire value. Normalize to plain str so
        # downstream serialization (e.g. model_dump) emits the wire token
        # rather than the enum's repr.
        if isinstance(value, State):
            return value.value
        return value.upper()
