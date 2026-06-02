"""Product types and selection for the prequalify API.

The catalog constant for each product lives in
:mod:`sah_sdk.catalog.products` as ``Products.Fex.AetnaAccendo`` etc.
``ProductSelection`` consumes those constants directly:

    ProductSelection.of([Products.Fex.AetnaAccendo])

The selection serializes to the ``products[]`` wire field via
:meth:`ProductSelection.to_wire_array`, which emits the opaque
``prod_<uuid>`` id. The id is the ONLY wire identity; slugs are never
sent on the wire.
"""

from __future__ import annotations

from collections.abc import Iterable, Sequence
from enum import Enum

from ..catalog.products import Product

# Re-export so callers can ``from sah_sdk.zyins.product import Product``.
__all__ = ["Product", "ProductSelection", "ProductType"]


class ProductType(str, Enum):
    """Coarse life-insurance product category.

    Product *selection* rides the opaque ``prod_<uuid>`` id (see
    :class:`ProductSelection`); this enum is the cross-SDK-stable category
    taxonomy every language SDK exposes with byte-identical wire values.
    """

    FINAL_EXPENSE = "final_expense"
    TERM = "term"
    WHOLE_LIFE = "whole_life"
    MEDICARE_SUPPLEMENT = "medicare_supplement"
    UNIVERSAL = "universal"
    INDEXED = "indexed"


class ProductSelection:
    """One or more :class:`Product` values for a single prequalify call.

    The only construction path is :meth:`of`::

        ProductSelection.of([Products.Fex.AetnaAccendo])

    Serializes to ``products[]`` via :meth:`to_wire_array` using the
    opaque ``prod_<uuid>`` id — never a slug.
    """

    __slots__ = ("_products",)

    def __init__(self, products: Iterable[Product]) -> None:
        items = tuple(products)
        if not items:
            raise ValueError("ProductSelection: at least one product is required")
        for i, p in enumerate(items):
            if not isinstance(p, Product):
                raise TypeError(
                    f"ProductSelection: item at index {i} is {type(p).__name__!r}, "
                    "expected a Product catalog constant (Products.Fex.AetnaAccendo, etc.)"
                )
            if not p.id:
                raise ValueError(
                    f"ProductSelection: product {p.name!r} has no id — "
                    "use a catalog constant from Products.Fex / Products.Term etc."
                )
        self._products: tuple[Product, ...] = items

    @classmethod
    def of(cls, products: Product | Sequence[Product]) -> ProductSelection:
        """Construct a selection from one or more catalog constants.

        Accepts a single :class:`Product` or a sequence of them::

            ProductSelection.of(Products.Fex.AetnaAccendo)
            ProductSelection.of([Products.Fex.AetnaAccendo, Products.Term.BannerOpterm])
        """
        if isinstance(products, Product):
            return cls([products])
        return cls(products)

    def list(self) -> tuple[Product, ...]:
        """The selected products."""
        return self._products

    def to_wire_array(self) -> tuple[str, ...]:
        """Return the ``products[]`` wire value: opaque ``prod_<uuid>`` ids.

        An id-less product is a hard error, not a 0-plan surprise. Use
        catalog constants from :data:`~sah_sdk.catalog.products.Products`.
        """
        result: list[str] = []
        for p in self._products:
            if not p.id:
                raise ValueError(
                    f"ProductSelection.to_wire_array: product {p.name!r} has no id — "
                    "only catalog constants (Products.Fex.AetnaAccendo etc.) are valid"
                )
            result.append(p.id)
        return tuple(result)
