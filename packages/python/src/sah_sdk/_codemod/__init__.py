"""``python -m sah_sdk._codemod`` — rewrite ``isa_sdk.zyins.*`` imports.

Idempotent libcst-based codemod for the 0.2.x → 0.3.0 migration. See
``MIGRATION.md`` for the full mapping table; the codemod implements
exactly that table.

Usage::

    python -m sah_sdk._codemod path/to/src           # rewrite in place
    python -m sah_sdk._codemod --dry-run path/to/src # report only

Exit codes:
    0 — clean (no changes needed, or all changes applied successfully)
    1 — at least one file would change in dry-run mode
    2 — a file was malformed and could not be rewritten

The codemod only touches recognized import patterns. Anything ambiguous
is left in place with a diagnostic on stderr.
"""

from __future__ import annotations

from typing import Any

__all__ = ["IsaSdkImportRewriter", "rewrite_file", "rewrite_tree"]

_CODEMOD_INSTALL_HINT = "pip install 'sah-sdk[codemod]'"


def __getattr__(name: str) -> Any:
    if name not in __all__:
        raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
    try:
        from . import rewriter
    except ModuleNotFoundError as exc:
        if exc.name == "libcst":
            raise ModuleNotFoundError(
                f"libcst is required for sah_sdk._codemod; install with {_CODEMOD_INSTALL_HINT}"
            ) from exc
        raise
    return getattr(rewriter, name)
