"""Coverage discriminated union.

Mirrors ``packages/zyins/js/src/coverage.ts``. The TS surface uses a
TypeScript discriminated-union plus static factories. The Python
equivalent is a single :class:`Coverage` model with a ``type`` literal
and two named constructors.
"""

from __future__ import annotations

from collections.abc import Sequence
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
    """Coverage request — face value or monthly budget, one amount or many.

    Construct via :meth:`Coverage.face_value` / :meth:`Coverage.monthly_budget`
    (single) or :meth:`Coverage.face_values` / :meth:`Coverage.monthly_budgets`
    (several amounts probed in one call). The discriminator is managed by
    the SDK; call sites never serialize the ``type`` field by hand.
    """

    model_config = ConfigDict(extra="forbid", frozen=True)

    type: CoverageType
    amount: int = Field(
        default=0, ge=0, description="Whole-dollar amount for a single-amount coverage."
    )
    amounts: tuple[int, ...] = Field(
        default=(),
        description="Whole-dollar amounts for a multi-amount probe; empty for single.",
    )

    # Re-export the type enum for ergonomic access on the class.
    FACE_VALUE: ClassVar[CoverageType] = CoverageType.FACE_VALUE
    MONTHLY_BUDGET: ClassVar[CoverageType] = CoverageType.MONTHLY_BUDGET

    @classmethod
    def face_value(cls, amount: int) -> Coverage:
        """Coverage by face value (death benefit) in whole US dollars."""
        return cls(type=CoverageType.FACE_VALUE, amount=_require_positive("face_value", amount))

    @classmethod
    def monthly_budget(cls, amount: int) -> Coverage:
        """Coverage by monthly premium budget in whole US dollars."""
        return cls(
            type=CoverageType.MONTHLY_BUDGET,
            amount=_require_positive("monthly_budget", amount),
        )

    @classmethod
    def face_values(cls, amounts: Sequence[int]) -> Coverage:
        """Probe several face-value (death-benefit) amounts in one call."""
        return cls(type=CoverageType.FACE_VALUE, amounts=_require_positive_seq("face_values", amounts))

    @classmethod
    def monthly_budgets(cls, amounts: Sequence[int]) -> Coverage:
        """Probe several monthly-premium ceilings in one call."""
        return cls(
            type=CoverageType.MONTHLY_BUDGET,
            amounts=_require_positive_seq("monthly_budgets", amounts),
        )

    @property
    def is_face_value(self) -> bool:
        return self.type is CoverageType.FACE_VALUE

    @property
    def is_monthly_budget(self) -> bool:
        return self.type is CoverageType.MONTHLY_BUDGET

    @property
    def is_multi(self) -> bool:
        """True when the coverage probes several amounts in one call."""
        return len(self.amounts) > 0


def _require_positive(label: str, amount: int) -> int:
    if amount <= 0:
        raise ValueError(f"Coverage.{label}: amount must be a positive integer")
    return amount


def _require_positive_seq(label: str, amounts: Sequence[int]) -> tuple[int, ...]:
    if not amounts:
        raise ValueError(f"Coverage.{label}: at least one amount required")
    for a in amounts:
        if a <= 0:
            raise ValueError(f"Coverage.{label}: amounts must be positive integers")
    return tuple(amounts)
