<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Reference\Internal;

/**
 * Optimal String Alignment distance (Damerau-Levenshtein restricted to
 * adjacent transpositions). Counts insertions, deletions, substitutions,
 * and swaps of two adjacent characters — so `chrons` → `crohns` costs 1,
 * not 2. The restriction (no substring edited more than once) is the
 * variant Elasticsearch and Algolia use; full Damerau is unnecessary for
 * typo recovery and costs more.
 *
 * Pure integer DP over two rolling rows plus the row before for the
 * transposition lookback — O(n·m) time, O(min(n,m)) space. Dependency-free
 * and identical across the language ports (mirrors the TS
 * `_damerauOsa.ts` reference branch-for-branch).
 *
 * @internal The fuzzy matcher is the only caller; consumers never touch
 * this directly.
 */
final class DamerauOsa
{
    /**
     * Length-scaled edit-distance band, matching Elasticsearch AUTO /
     * Algolia, widened by one for the longer compound terms common in the
     * medical catalog (`hydrochlorothiazide`, `levothyroxine`):
     *   - queries shorter than {@see FUZZY_SHORT_LEN}: ≤ 1
     *   - {@see FUZZY_SHORT_LEN}–{@see FUZZY_MEDIUM_LEN}: ≤ 1
     *   - longer: ≤ 2 (the cap)
     */
    public const FUZZY_SHORT_LEN = 6;
    public const FUZZY_MEDIUM_LEN = 12;
    public const MAX_EDIT_DISTANCE = 2;

    /**
     * Maximum edit distance tolerated for a query of the given length.
     * Drives the Damerau tier's accept/reject decision; never exceeds
     * {@see MAX_EDIT_DISTANCE}.
     */
    public static function thresholdForLength(int $queryLength): int
    {
        if ($queryLength < self::FUZZY_SHORT_LEN) {
            return 1;
        }
        if ($queryLength <= self::FUZZY_MEDIUM_LEN) {
            return 1;
        }
        return self::MAX_EDIT_DISTANCE;
    }

    /**
     * Compute the OSA distance between `a` and `b`, returning early once
     * every cell in the active row exceeds `maxDistance` so a far-apart
     * pair costs far less than the full matrix.
     *
     * Both inputs are ASCII catalog keys (the `make_key` output), so
     * byte-indexing is codepoint-indexing — identical to the TS
     * `charAt`-based reference.
     */
    public static function distance(string $a, string $b, int $maxDistance = self::MAX_EDIT_DISTANCE): int
    {
        if ($a === $b) {
            return 0;
        }
        $lenA = strlen($a);
        $lenB = strlen($b);
        if ($lenA === 0) {
            return $lenB;
        }
        if ($lenB === 0) {
            return $lenA;
        }
        if (abs($lenA - $lenB) > $maxDistance) {
            return $maxDistance + 1;
        }

        $cols = $lenB + 1;
        $prevPrev = array_fill(0, $cols, 0);
        $prev = range(0, $lenB);
        $curr = array_fill(0, $cols, 0);

        for ($i = 1; $i <= $lenA; $i++) {
            $curr[0] = $i;
            $rowMin = $curr[0];
            for ($j = 1; $j <= $lenB; $j++) {
                $cost = $a[$i - 1] === $b[$j - 1] ? 0 : 1;
                $value = min(
                    $prev[$j] + 1,
                    $curr[$j - 1] + 1,
                    $prev[$j - 1] + $cost,
                );
                if (
                    $i > 1
                    && $j > 1
                    && $a[$i - 1] === $b[$j - 2]
                    && $a[$i - 2] === $b[$j - 1]
                ) {
                    $value = min($value, $prevPrev[$j - 2] + 1);
                }
                $curr[$j] = $value;
                if ($value < $rowMin) {
                    $rowMin = $value;
                }
            }
            if ($rowMin > $maxDistance) {
                return $maxDistance + 1;
            }
            [$prevPrev, $prev, $curr] = [$prev, $curr, $prevPrev];
        }
        return $prev[$lenB];
    }

    private function __construct()
    {
    }
}
