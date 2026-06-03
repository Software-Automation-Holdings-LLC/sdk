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
 * and identical across the language ports.
 */
/**
 * Length-scaled edit-distance ceiling, matching Elasticsearch AUTO /
 * Algolia, widened by one for the longer compound terms common in the
 * medical catalog (`hydrochlorothiazide`, `levothyroxine`):
 *   - queries shorter than {@link FUZZY_SHORT_LEN}: exact only (≤ 0... see note)
 *   - {@link FUZZY_SHORT_LEN}–{@link FUZZY_MEDIUM_LEN}: ≤ 1
 *   - longer: ≤ 2 (the cap)
 *
 * The brief specifies ≤ 1 for queries under 6 chars; the band table below
 * encodes exactly that (1 for [1,6), 1 for [6,12], 2 beyond), capped at 2.
 */
export declare const FUZZY_SHORT_LEN = 6;
export declare const FUZZY_MEDIUM_LEN = 12;
/**
 * Maximum edit distance tolerated for a query of the given length. Drives
 * the Damerau tier's accept/reject decision; never exceeds
 * {@link MAX_EDIT_DISTANCE}.
 */
export declare function fuzzyThresholdForLength(queryLength: number): number;
/**
 * Compute the OSA distance between `a` and `b`. Returns early once every
 * cell in the active row exceeds `maxDistance`, so a far-apart pair costs
 * far less than the full matrix.
 */
export declare function optimalStringAlignmentDistance(a: string, b: string, maxDistance?: number): number;
//# sourceMappingURL=_damerauOsa.d.ts.map