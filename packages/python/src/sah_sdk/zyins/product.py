"""Product types and selection.

Mirrors ``packages/zyins/js/src/product.ts``. A :class:`Product` has a
brand, a type, and a wire token. A :class:`ProductSelection` renders to
the ``|``-joined wire string the engine accepts.
"""

from __future__ import annotations

from collections.abc import Iterable
from enum import Enum

from pydantic import BaseModel, ConfigDict


class ProductType(str, Enum):
    FINAL_EXPENSE = "final_expense"
    TERM = "term"
    WHOLE_LIFE = "whole_life"
    MEDICARE_SUPPLEMENT = "medicare_supplement"
    UNIVERSAL = "universal"
    INDEXED = "indexed"


class Product(BaseModel):
    """A single carrier-and-type product entry."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    brand: str
    type: ProductType
    wire_token: str
    display_name: str


class ProductSelection:
    """One or more :class:`Product` values for a single API call."""

    __slots__ = ("_products",)

    def __init__(self, products: Iterable[Product]) -> None:
        items = tuple(products)
        if not items:
            raise ValueError("ProductSelection: at least one product is required")
        self._products: tuple[Product, ...] = items

    @classmethod
    def of(cls, product: Product) -> ProductSelection:
        return cls([product])

    @classmethod
    def many(cls, products: Iterable[Product]) -> ProductSelection:
        return cls(products)

    def list(self) -> tuple[Product, ...]:
        return self._products

    def to_wire_string(self) -> str:
        """Render to the engine's ``|``-joined wire format."""
        return "|".join(p.wire_token for p in self._products)


def default_catalog() -> tuple[Product, ...]:
    """The default product list shipped with the SDK."""
    return (
        Product(
            brand="colonial-penn",
            type=ProductType.FINAL_EXPENSE,
            wire_token="colonial-penn.final-expense",
            display_name="Colonial Penn Final Expense",
        ),
        Product(
            brand="mutual-of-omaha",
            type=ProductType.FINAL_EXPENSE,
            wire_token="mutual-of-omaha.final-expense",
            display_name="Mutual of Omaha Final Expense",
        ),
        Product(
            brand="aetna",
            type=ProductType.MEDICARE_SUPPLEMENT,
            wire_token="aetna.medicare-supplement",
            display_name="Aetna Medicare Supplement",
        ),
    )
