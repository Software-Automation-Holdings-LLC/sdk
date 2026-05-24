"""Coverage discriminated union.

Mirrors ``packages/zyins/js/src/coverage.ts``. The TS surface uses a
TypeScript discriminated-union plus static factories. The Python
equivalent is a single :class:`Coverage` model with a ``type`` literal
and two named constructors.
"""

from __future__ import annotations

from enum import Enum
from typing import ClassVar

from pydantic import BaseModel, ConfigDict, Field


class CoverageType(str, Enum):
    """Discriminator for :class:`Coverage`."""

    FACE_VALUE = "face_value"
    MONTHLY_BUDGET = "monthly_budget"


class QuoteType(str, Enum):
    """Wire discriminator for the ``quote_options.quote_type`` field.

    Values mirror the server's ``QuoteType`` enum exactly.
    """

    FACE_AMOUNTS = "face_amounts"
    MONTHLY_BUDGET = "monthly_budget"


class Coverage(BaseModel):
    """Coverage request — either a face value or a monthly budget.

    Construct via :meth:`Coverage.face_value` or
    :meth:`Coverage.monthly_budget`. The discriminator is managed by the
    SDK; call sites never serialize the ``type`` field by hand.
    """

    model_config = ConfigDict(extra="forbid", frozen=True)

    type: CoverageType
    amount: int = Field(..., ge=1, description="Whole-dollar amount.")

    # Re-export the type enum for ergonomic access on the class.
    FACE_VALUE: ClassVar[CoverageType] = CoverageType.FACE_VALUE
    MONTHLY_BUDGET: ClassVar[CoverageType] = CoverageType.MONTHLY_BUDGET

    @classmethod
    def face_value(cls, amount: int) -> Coverage:
        """Coverage by face value (death benefit) in whole US dollars."""
        return cls(type=CoverageType.FACE_VALUE, amount=(amount))

    @classmethod
    def monthly_budget(cls, amount: int) -> Coverage:
        """Coverage by monthly premium budget in whole US dollars."""
        return cls(type=CoverageType.MONTHLY_BUDGET, amount=(amount))

    @property
    def is_face_value(self) -> bool:
        return self.type is CoverageType.FACE_VALUE

    @property
    def is_monthly_budget(self) -> bool:
        return self.type is CoverageType.MONTHLY_BUDGET
