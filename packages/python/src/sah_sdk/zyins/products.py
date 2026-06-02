"""Deprecated: ``ProductsFacade`` has been removed.

Use the rich catalog constants at :data:`sah_sdk.catalog.products.Products`
instead::

    from sah_sdk.catalog.products import Products
    Products.Fex.AetnaAccendo  # -> Product(id='prod_...', ...)

This module is kept so that ``import sah_sdk.zyins.products`` does not raise
``ImportError``, but any attribute access on symbols that no longer exist will
produce a clear ``AttributeError`` with a migration hint rather than a cryptic
``module has no attribute`` message.
"""

from __future__ import annotations

from typing import NoReturn


class _RemovedSymbol:
    """Placeholder for symbols removed in the id-only catalog cutover."""

    def __init__(self, name: str, hint: str) -> None:
        self._name = name
        self._hint = hint

    def __repr__(self) -> str:  # pragma: no cover
        return f"<removed symbol {self._name!r}: {self._hint}>"

    def __call__(self, *args: object, **kwargs: object) -> NoReturn:
        raise AttributeError(f"{self._name} has been removed. {self._hint}")


# Deprecated shim: ``from sah_sdk.zyins.products import ProductsFacade`` now
# returns a sentinel that raises on use rather than silently failing.
ProductsFacade = _RemovedSymbol(
    "ProductsFacade",
    "Use `from sah_sdk.catalog.products import Products` instead. "
    "Access products as `Products.Fex.AetnaAccendo`, `Products.byId(id)`, etc.",
)

__all__ = ["ProductsFacade"]
