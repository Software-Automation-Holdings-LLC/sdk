"""``sah_sdk.rapidsign`` — RapidSign signature workflow product namespace.

This module is a scaffolded stub. The full operation surface
(``documents.create``, ``envelopes.send``, etc.) lands in a follow-up
phase. The :class:`RapidsignNamespace` is present today so consumer code
can be written against ``isa.rapidsign`` without breaking when those
methods land; calls into placeholder operations raise
:class:`NotImplementedError` with a clear message pointing at the
roadmap.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:  # pragma: no cover
    from ..isa import Isa


class RapidsignNamespace:
    """``isa.rapidsign`` — placeholder for RapidSign operations."""

    def __init__(self, isa: Isa) -> None:
        self._isa = isa

    def __repr__(self) -> str:
        return "RapidsignNamespace(<not yet implemented>)"


__all__ = ["RapidsignNamespace"]
