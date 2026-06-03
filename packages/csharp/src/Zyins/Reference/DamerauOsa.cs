// `Isa.Sdk.Zyins.Reference.DamerauOsa` — Optimal String Alignment distance
// (Damerau-Levenshtein restricted to adjacent transpositions), ported from
// the SDK's TypeScript reference
// (`packages/ts/src/zyins/reference/_damerauOsa.ts`).
//
// Counts insertions, deletions, substitutions, and swaps of two adjacent
// characters — so `chrons` → `crohns` costs 1, not 2. The restriction (no
// substring edited more than once) is the variant Elasticsearch and Algolia
// use; full Damerau is unnecessary for typo recovery and costs more.
//
// Pure integer DP over two rolling rows plus the row before for the
// transposition lookback — O(n·m) time, O(min(n,m)) space. Identical across
// the language ports.

using System;

namespace Isa.Sdk.Zyins.Reference;

internal static class DamerauOsa
{
    // Length-scaled edit-distance band, matching Elasticsearch AUTO /
    // Algolia, widened by one for the longer compound terms common in the
    // medical catalog. The brief specifies ≤ 1 for queries under
    // FuzzyShortLen; the table encodes 1 for [1,6), 1 for [6,12], 2 beyond,
    // capped at MaxEditDistance.
    public const int FuzzyShortLen = 6;
    public const int FuzzyMediumLen = 12;
    private const int MaxEditDistance = 2;

    /// <summary>Maximum edit distance tolerated for a query of the given
    /// length. Drives the Damerau tier's accept/reject decision; never
    /// exceeds <c>MaxEditDistance</c>.</summary>
    public static int ThresholdForLength(int queryLength)
    {
        if (queryLength < FuzzyShortLen) return 1;
        if (queryLength <= FuzzyMediumLen) return 1;
        return MaxEditDistance;
    }

    /// <summary>Compute the OSA distance between <paramref name="a"/> and
    /// <paramref name="b"/>. Returns early once every cell in the active row
    /// exceeds <paramref name="maxDistance"/>, so a far-apart pair costs far
    /// less than the full matrix.</summary>
    public static int Distance(string a, string b, int maxDistance = MaxEditDistance)
    {
        if (string.Equals(a, b, StringComparison.Ordinal)) return 0;
        if (a.Length == 0) return b.Length;
        if (b.Length == 0) return a.Length;
        if (Math.Abs(a.Length - b.Length) > maxDistance) return maxDistance + 1;

        var cols = b.Length + 1;
        var prevPrev = new int[cols];
        var prev = new int[cols];
        var curr = new int[cols];
        for (var j = 0; j < cols; j++) prev[j] = j;

        for (var i = 1; i <= a.Length; i++)
        {
            curr[0] = i;
            var rowMin = curr[0];
            for (var j = 1; j <= b.Length; j++)
            {
                var cost = a[i - 1] == b[j - 1] ? 0 : 1;
                var value = Min3(
                    prev[j] + 1,        // deletion
                    curr[j - 1] + 1,    // insertion
                    prev[j - 1] + cost); // substitution
                if (i > 1 && j > 1 &&
                    a[i - 1] == b[j - 2] &&
                    a[i - 2] == b[j - 1])
                {
                    value = Math.Min(value, prevPrev[j - 2] + 1); // transposition
                }
                curr[j] = value;
                if (value < rowMin) rowMin = value;
            }
            if (rowMin > maxDistance) return maxDistance + 1;
            // Rotate the three rows: prevPrev ← prev ← curr ← old prevPrev.
            var spare = prevPrev;
            prevPrev = prev;
            prev = curr;
            curr = spare;
        }
        return prev[b.Length];
    }

    private static int Min3(int x, int y, int z) => Math.Min(x, Math.Min(y, z));
}
