"""``isa.zyins.products`` — live product catalog with memoization.

:meth:`ProductsFacade.catalog` calls
``isa.zyins.datasets.get(include=["products"])`` once and memoizes the
resulting :class:`~sah_sdk.zyins.product.ProductCatalog` for the lifetime
of the facade instance. Subsequent calls return the cached catalog
without a network round-trip.

The catalog is invalidated only on facade recreation (i.e. when a new
``ZyInsClient`` is constructed). For long-lived processes that need fresh
product lists, call :meth:`ProductsFacade.refresh` to force a re-fetch.
"""

from __future__ import annotations

from collections.abc import Callable, Mapping
from typing import Any

from .product import ProductCatalog


class ProductsFacade:
    """``client.products`` — live product catalog with memoization.

    Do not construct directly; obtain from ``ZyInsClient.products``.
    """

    __slots__ = ("_cached", "_get_products")

    def __init__(self, get_products: Callable[[], Mapping[str, Any]]) -> None:
        self._get_products = get_products
        self._cached: ProductCatalog | None = None

    def catalog(self) -> ProductCatalog:
        """Return the :class:`~sah_sdk.zyins.product.ProductCatalog` built
        from the server's products dataset.

        The first call fetches from ``GET /v1/reference-data``; subsequent
        calls return the memoized result instantly.
        """
        if self._cached is not None:
            return self._cached
        bundle = self._get_products()
        cat = ProductCatalog.from_datasets(bundle)
        self._cached = cat
        return cat

    def refresh(self) -> ProductCatalog:
        """Evict the cached catalog and re-fetch on the next :meth:`catalog` call.

        Returns the freshly fetched :class:`~sah_sdk.zyins.product.ProductCatalog`.
        """
        self._cached = None
        return self.catalog()
