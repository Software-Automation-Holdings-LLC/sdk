"""Optimal String Alignment distance — the Damerau tier's metric.

Mirror of ``packages/ts/src/zyins/reference/_damerauOsa.ts``. OSA is
Damerau-Levenshtein restricted to adjacent transpositions (no substring
edited more than once), so ``chrons`` -> ``crohns`` costs 1, not 2. This
is the variant Elasticsearch and Algolia use; full Damerau is unnecessary
for typo recovery and costs more.

Pure integer DP over three rolling rows — the row before last carries the
transposition lookback. O(n·m) time, O(min(n,m)) space. Dependency-free
and identical across the language ports.
"""

from __future__ import annotations

# Length-scaled edit-distance band, matching Elasticsearch AUTO / Algolia,
# widened by one for the longer compound terms common in the medical
# catalog (``hydrochlorothiazide``, ``levothyroxine``):
#   - queries shorter than FUZZY_SHORT_LEN: <= 1
#   - FUZZY_SHORT_LEN..FUZZY_MEDIUM_LEN:    <= 1
#   - longer:                               <= 2 (the cap)
FUZZY_SHORT_LEN = 6
FUZZY_MEDIUM_LEN = 12
_MAX_EDIT_DISTANCE = 2


def fuzzy_threshold_for_length(query_length: int) -> int:
    """Maximum edit distance tolerated for a query of the given length.

    Drives the Damerau tier's accept/reject decision; never exceeds the
    cap of 2. Mirrors ``fuzzyThresholdForLength`` in the TS source.
    """
    if query_length < FUZZY_SHORT_LEN:
        return 1
    if query_length <= FUZZY_MEDIUM_LEN:
        return 1
    return _MAX_EDIT_DISTANCE


def optimal_string_alignment_distance(
    a: str, b: str, max_distance: int = _MAX_EDIT_DISTANCE
) -> int:
    """Compute the OSA distance between ``a`` and ``b``.

    Returns early once every cell in the active row exceeds
    ``max_distance``, so a far-apart pair costs far less than the full
    matrix. Mirrors ``optimalStringAlignmentDistance`` branch-for-branch.
    """
    if a == b:
        return 0
    if len(a) == 0:
        return len(b)
    if len(b) == 0:
        return len(a)
    if abs(len(a) - len(b)) > max_distance:
        return max_distance + 1

    cols = len(b) + 1
    prev_prev = [0] * cols
    prev = list(range(cols))
    curr = [0] * cols

    for i in range(1, len(a) + 1):
        curr[0] = i
        row_min = curr[0]
        for j in range(1, len(b) + 1):
            cost = 0 if a[i - 1] == b[j - 1] else 1
            value = min(
                prev[j] + 1,  # deletion
                curr[j - 1] + 1,  # insertion
                prev[j - 1] + cost,  # substitution
            )
            if i > 1 and j > 1 and a[i - 1] == b[j - 2] and a[i - 2] == b[j - 1]:
                value = min(value, prev_prev[j - 2] + 1)  # transposition
            curr[j] = value
            if value < row_min:
                row_min = value
        if row_min > max_distance:
            return max_distance + 1
        prev_prev, prev, curr = prev, curr, prev_prev

    return prev[len(b)]


__all__ = [
    "FUZZY_MEDIUM_LEN",
    "FUZZY_SHORT_LEN",
    "fuzzy_threshold_for_length",
    "optimal_string_alignment_distance",
]
