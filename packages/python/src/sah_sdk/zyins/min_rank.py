"""Minimum guaranteed-issue rank accepted by the server's ``min_rank`` filter.

The canonical members are :attr:`MinRank.IMMEDIATE`, :attr:`MinRank.GRADED`,
:attr:`MinRank.ROP`, and :attr:`MinRank.GUARANTEED`; ``RETURN_OF_PREMIUM``,
``GUARANTEED_ISSUE``, and ``GI`` are Enum aliases that resolve to the canonical
member sharing their wire token. The server compares case-insensitively and also
tolerates numeric strings, so request fields stay typed as ``str`` — this enum is
for ergonomics and autocomplete, not a hard gate.
"""

from __future__ import annotations

from enum import Enum

__all__ = ["MinRank"]


class MinRank(str, Enum):
    """Minimum guaranteed-issue rank for ``options.min_rank``.

    Subclasses ``str`` so members serialize to their lowercase wire token
    directly. ``RETURN_OF_PREMIUM``/``GUARANTEED_ISSUE``/``GI`` are aliases:
    Python collapses members that share a value onto the first canonical member,
    so ``MinRank.GI is MinRank.GUARANTEED``.
    """

    IMMEDIATE = "immediate"
    GRADED = "graded"
    ROP = "rop"
    GUARANTEED = "guaranteed"
    # Synonyms — Enum aliasing maps these onto the canonical member above.
    RETURN_OF_PREMIUM = "rop"
    GUARANTEED_ISSUE = "guaranteed"
    GI = "guaranteed"
