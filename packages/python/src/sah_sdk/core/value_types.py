"""Generic value types shared across products.

These mirror SDK_DESIGN.md §5: small typed wrappers that read as
intent at call sites (``Money(1995, "USD")`` instead of an integer that
could mean cents, dollars, or anything else). All three are immutable
value objects with validation at construction time.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from decimal import Decimal
from typing import Final

# ---------------------------------------------------------------------------
# Money
# ---------------------------------------------------------------------------

_CURRENCY_PATTERN: Final = re.compile(r"^[A-Z]{3}$")


@dataclass(frozen=True, slots=True)
class Money:
    """A monetary amount in the smallest currency unit (cents for USD).

    ``amount_minor`` is an integer to avoid floating-point rounding;
    ``currency`` is an ISO 4217 three-letter code. ``Money(1995, "USD")``
    represents nineteen dollars and ninety-five cents.
    """

    amount_minor: int
    currency: str

    def __post_init__(self) -> None:
        if not isinstance(self.amount_minor, int) or isinstance(self.amount_minor, bool):
            raise TypeError("Money.amount_minor must be an int (minor units)")
        if not _CURRENCY_PATTERN.fullmatch(self.currency):
            raise ValueError(
                "Money.currency must be a 3-letter uppercase ISO 4217 code"
            )

    def to_major(self) -> Decimal:
        """Return the amount as a ``Decimal`` in major units (e.g. dollars)."""
        return Decimal(self.amount_minor) / Decimal(100)


# ---------------------------------------------------------------------------
# Email
# ---------------------------------------------------------------------------

# Deliberately permissive: full RFC 5321 grammar is unenforceable and
# the SDK is not the canonical validator; we only reject obvious shape
# errors here. The server enforces the strict rules.
_EMAIL_PATTERN: Final = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


@dataclass(frozen=True, slots=True)
class Email:
    """An email address, normalized to lowercase."""

    value: str

    def __post_init__(self) -> None:
        if not isinstance(self.value, str) or not _EMAIL_PATTERN.fullmatch(self.value):
            raise ValueError("Email.value is not a syntactically valid email address")
        # Normalize to lowercase to match the platform's lookup contract
        # (the agent license registry stores emails normalized).
        object.__setattr__(self, "value", self.value.lower())

    def __str__(self) -> str:
        return self.value


# ---------------------------------------------------------------------------
# URL
# ---------------------------------------------------------------------------

_URL_PATTERN: Final = re.compile(r"^https?://[^\s]+$")


@dataclass(frozen=True, slots=True)
class Url:
    """An HTTP(S) URL. Plain shape validation only — no DNS or reachability."""

    value: str

    def __post_init__(self) -> None:
        if not isinstance(self.value, str) or not _URL_PATTERN.fullmatch(self.value):
            raise ValueError("Url.value must be an http:// or https:// URL")

    def __str__(self) -> str:
        return self.value


__all__ = ["Email", "Money", "Url"]
