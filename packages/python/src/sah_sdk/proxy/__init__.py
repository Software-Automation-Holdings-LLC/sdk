"""``sah_sdk.proxy`` — proxy product namespace.

Scaffolded stub. The proxy product surface lands in a follow-up phase;
:class:`ProxyNamespace` is published today so ``isa.proxy`` resolves on
the unified ``Isa`` instance.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:  # pragma: no cover
    from ..isa import Isa


class ProxyNamespace:
    """``isa.proxy`` — placeholder for proxy operations."""

    def __init__(self, isa: Isa) -> None:
        self._isa = isa

    def __repr__(self) -> str:
        return "ProxyNamespace(<not yet implemented>)"


__all__ = ["ProxyNamespace"]
