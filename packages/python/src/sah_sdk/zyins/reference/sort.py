"""``Sort`` — namespaced sort orders for symmetric :class:`Concept` accessors.

Mirror of ``packages/ts/src/zyins/reference.ts`` (``Sort.MostCommonFirst``
/ ``Alphabetical``). The enum is the single source of truth for sort
orders on the SDK surface: no ``asc`` / ``desc``, no closures, no string
aliases. New sort orders ship as new enum members so old SDKs reject
unknown values instead of silently mis-sorting.
"""

from __future__ import annotations

from enum import Enum


class Sort(str, Enum):
    """Sort orders for the symmetric accessors on a :class:`Concept`.

    Members
    -------
    MOST_COMMON_FIRST
        Sort by descending prescription frequency from the v3
        ``frequency_graphs.use_map``. Default on every accessor.
    ALPHABETICAL
        Sort by display name, case-insensitive, locale-default.
    """

    MOST_COMMON_FIRST = "most_common_first"
    ALPHABETICAL = "alphabetical"


__all__ = ["Sort"]
