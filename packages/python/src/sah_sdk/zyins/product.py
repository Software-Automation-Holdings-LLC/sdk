"""Product types, selection, and catalog.

Mirrors ``packages/zyins/js/src/product.ts``. A :class:`Product` has a
brand, a type, and a wire token. A :class:`ProductSelection` renders to
the wire ``products`` array the engine accepts. A :class:`ProductCatalog`
provides ``find``, ``find_by_slug``, and a datasets-bundle constructor.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from enum import Enum
from typing import Any

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

    def to_wire_array(self) -> tuple[str, ...]:
        """Return the wire token tuple the prequalify body's ``products`` field accepts."""
        return tuple(p.wire_token for p in self._products)

    def to_wire_string(self) -> str:
        """Render to the ``|``-joined wire format.

        .. deprecated::
            Use :meth:`to_wire_array` instead. The server's ``products``
            field is a ``string[]``; joining with ``|`` is a legacy
            convention. This method will be removed in v0.7.0.
        """
        return "|".join(p.wire_token for p in self._products)


def _map_product_class(cls_key: str) -> ProductType:
    normalized = cls_key.lower()
    mapping: dict[str, ProductType] = {
        "fex": ProductType.FINAL_EXPENSE,
        "term": ProductType.TERM,
        "wl": ProductType.WHOLE_LIFE,
        "whole_life": ProductType.WHOLE_LIFE,
        "wholelife": ProductType.WHOLE_LIFE,
        "medsup": ProductType.MEDICARE_SUPPLEMENT,
        "medicare_supplement": ProductType.MEDICARE_SUPPLEMENT,
        "ul": ProductType.UNIVERSAL,
        "universal": ProductType.UNIVERSAL,
        "indexed": ProductType.INDEXED,
    }
    return mapping.get(normalized, ProductType.FINAL_EXPENSE)


def _raw_entry_to_product(entry: Any) -> Product | None:
    """Convert a raw datasets bundle entry to a :class:`Product`.

    Returns ``None`` for entries that are missing required fields so
    forward-compatible additions never break catalog construction.
    """
    if not isinstance(entry, dict):
        return None
    identifier = entry.get("identifier")
    carrier = entry.get("carrier")
    name = entry.get("name")
    if not isinstance(identifier, str) or not isinstance(carrier, str) or not isinstance(name, str):
        return None
    product_class = entry.get("product", "")
    if not isinstance(product_class, str):
        return None
    return Product(
        brand=carrier,
        type=_map_product_class(product_class),
        wire_token=identifier,
        display_name=name,
    )


class ProductCatalog:
    """In-memory catalog of known products.

    Two construction paths:

    - :meth:`ProductCatalog.default` — the static built-in list; always available.
    - :meth:`ProductCatalog.from_datasets` — built from a live datasets
      bundle so the catalog stays in sync with the server.

    :meth:`find` and :meth:`find_by_slug` are the documented entry points.
    """

    __slots__ = ("_products",)

    def __init__(self, products: Iterable[Product]) -> None:
        self._products: tuple[Product, ...] = tuple(products)

    @classmethod
    def default(cls) -> ProductCatalog:
        """The default catalog shipped with the SDK."""
        return cls(default_catalog())

    @classmethod
    def from_datasets(cls, bundle: Mapping[str, Any]) -> ProductCatalog:
        """Build a catalog from a datasets bundle.

        ``bundle`` must have a ``products`` key whose value is a mapping
        of product-class keys to lists of raw product entry objects, as
        returned by ``isa.zyins.datasets.get(include=['products'])``.
        Entries missing required fields are silently skipped.
        """
        products_data = bundle.get("products", {})
        if not isinstance(products_data, dict):
            return cls(())
        products: list[Product] = []
        for value in products_data.values():
            if not isinstance(value, list):
                continue
            for entry in value:
                product = _raw_entry_to_product(entry)
                if product is not None:
                    products.append(product)
        return cls(products)

    def find(self, brand: str, product_type: ProductType) -> Product:
        """Look up a product by brand and type. Raises if no match."""
        found = self.try_find(brand, product_type)
        if found is None:
            raise KeyError(
                f"ProductCatalog.find: no product matches brand={brand!r} type={product_type.value!r}"
            )
        return found

    def try_find(self, brand: str, product_type: ProductType) -> Product | None:
        """Soft variant of :meth:`find`; returns ``None`` if no match."""
        return next(
            (p for p in self._products if p.brand == brand and p.type is product_type),
            None,
        )

    def find_by_slug(self, slug: str) -> Product:
        """Look up a product by its wire token slug. Raises if no match."""
        found = self.try_find_by_slug(slug)
        if found is None:
            raise KeyError(f"ProductCatalog.find_by_slug: no product matches slug={slug!r}")
        return found

    def try_find_by_slug(self, slug: str) -> Product | None:
        """Soft variant of :meth:`find_by_slug`; returns ``None`` if no match."""
        return next((p for p in self._products if p.wire_token == slug), None)

    def list(self) -> tuple[Product, ...]:
        """All products in the catalog (read-only)."""
        return self._products


def default_catalog() -> tuple[Product, ...]:
    """The default product list shipped with the SDK.

    Returned fresh each call to prevent accidental mutation across call sites.
    """
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
