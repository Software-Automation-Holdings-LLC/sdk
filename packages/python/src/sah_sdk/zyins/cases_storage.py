"""Backwards-compatibility shim for ``sah_sdk.zyins.cases_storage``.

The canonical location for the ``CaseStorage`` Protocol + value types
is :mod:`sah_sdk.zyins.cases.storage` (PR #365 moved them inside the
``cases`` package alongside :class:`ZeroKnowledgeCaseStorage`). This
module re-exports the public names so older imports
(``from sah_sdk.zyins.cases_storage import CaseStorage``) keep working
without churning the call sites that landed before the move.

Prefer the canonical path in new code:

    from sah_sdk.zyins.cases import CaseStorage, CaseRecord, PutResult
"""

from __future__ import annotations

from .cases.storage import CaseRecord, CaseStorage, PutResult

__all__ = ["CaseRecord", "CaseStorage", "PutResult"]
