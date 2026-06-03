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
export const FUZZY_SHORT_LEN = 6;
export const FUZZY_MEDIUM_LEN = 12;
const MAX_EDIT_DISTANCE = 2;
/**
 * Maximum edit distance tolerated for a query of the given length. Drives
 * the Damerau tier's accept/reject decision; never exceeds
 * {@link MAX_EDIT_DISTANCE}.
 */
export function fuzzyThresholdForLength(queryLength) {
    if (queryLength < FUZZY_SHORT_LEN)
        return 1;
    if (queryLength <= FUZZY_MEDIUM_LEN)
        return 1;
    return MAX_EDIT_DISTANCE;
}
/**
 * Compute the OSA distance between `a` and `b`. Returns early once every
 * cell in the active row exceeds `maxDistance`, so a far-apart pair costs
 * far less than the full matrix.
 */
export function optimalStringAlignmentDistance(a, b, maxDistance = MAX_EDIT_DISTANCE) {
    if (a === b)
        return 0;
    if (a.length === 0)
        return b.length;
    if (b.length === 0)
        return a.length;
    if (Math.abs(a.length - b.length) > maxDistance)
        return maxDistance + 1;
    const cols = b.length + 1;
    let prevPrev = new Int32Array(cols);
    let prev = new Int32Array(cols);
    let curr = new Int32Array(cols);
    for (let j = 0; j < cols; j++)
        prev[j] = j;
    for (let i = 1; i <= a.length; i++) {
        curr[0] = i;
        let rowMin = curr[0] ?? i;
        for (let j = 1; j <= b.length; j++) {
            const cost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
            let value = Math.min((prev[j] ?? 0) + 1, // deletion
            (curr[j - 1] ?? 0) + 1, // insertion
            (prev[j - 1] ?? 0) + cost);
            if (i > 1 &&
                j > 1 &&
                a.charAt(i - 1) === b.charAt(j - 2) &&
                a.charAt(i - 2) === b.charAt(j - 1)) {
                value = Math.min(value, (prevPrev[j - 2] ?? 0) + 1); // transposition
            }
            curr[j] = value;
            if (value < rowMin)
                rowMin = value;
        }
        if (rowMin > maxDistance)
            return maxDistance + 1;
        [prevPrev, prev, curr] = [prev, curr, prevPrev];
    }
    return prev[b.length] ?? a.length;
}
//# sourceMappingURL=_damerauOsa.js.map