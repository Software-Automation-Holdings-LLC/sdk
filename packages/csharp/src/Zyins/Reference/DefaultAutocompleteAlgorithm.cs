// <c>DefaultAutocompleteAlgorithm</c> — port of the bucketed algorithm
// from <c>bpp2.0/src/sah-ui/Input/TextField/useAutocomplete.js</c>.
//
// Pipeline:
//   1. Filter candidates by simple substring / prefix tests
//      (replicates the JS web-worker pre-filter).
//   2. Categorize survivors into six ranked buckets.
//   3. Apply within-bucket frequency boost when the frequencies map
//      contains at least one candidate id.
//   4. Flatten + de-dupe + truncate to <c>options.Limit</c>.
//
// The algorithm is fully synchronous in C# — the async signature
// preserves cross-language parity with the JS Worker variant.
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace Isa.Sdk.Zyins.Reference;

/// <summary>Reference implementation of
/// <see cref="IAutocompleteAlgorithm"/>. Stateless and thread-safe.</summary>
public sealed class DefaultAutocompleteAlgorithm : IAutocompleteAlgorithm
{
    private static readonly char[] Whitespace = new[] { ' ', '\t', '\n', '\r' };

    /// <summary>Construct with an optional version tag pinning the
    /// adapter to a specific catalog revision.</summary>
    public DefaultAutocompleteAlgorithm(string? versionTag = null)
    {
        VersionTag = versionTag;
    }

    /// <inheritdoc/>
    public string? VersionTag { get; }

    /// <summary>Return a clone with selected fields overridden.</summary>
    public DefaultAutocompleteAlgorithm Clone(string? versionTag = null) =>
        new(versionTag ?? VersionTag);

    /// <inheritdoc/>
    public Task<IReadOnlyList<Suggestion>> Rank(
        string query,
        IReadOnlyCollection<IConcept> candidates,
        AutocompleteOptions options,
        CancellationToken ct = default)
    {
        if (query is null) throw new ArgumentNullException(nameof(query));
        if (candidates is null) throw new ArgumentNullException(nameof(candidates));
        if (options is null) throw new ArgumentNullException(nameof(options));
        if (query.Length == 0 || candidates.Count == 0)
        {
            return Task.FromResult<IReadOnlyList<Suggestion>>(Array.Empty<Suggestion>());
        }

        var kinds = options.Kinds;
        var pool = kinds is null
            ? (IReadOnlyCollection<IConcept>)candidates
            : candidates.Where(c => kinds.Contains(c.Kind)).ToList();

        var queryUpper = query.ToUpperInvariant();
        var queryWords = AutocompleteTokens.Tokenize(query);
        var filtered = AutocompleteFilter.Filter(pool, queryUpper, queryWords);
        var buckets = AutocompleteBuckets.Categorize(filtered, queryWords, queryUpper);
        var grouped = AutocompleteBuckets.Flatten(buckets);
        // Alphabetical collapses every bucket into one A→Z group (the relevance
        // filter already decided membership); the default boosts by frequency,
        // keeping the group structure so each group's scale is preserved.
        var groups = options.Sort == Sort.Alphabetical
            ? new List<List<IConcept>> { AutocompleteFrequency.FlattenAlphabetical(grouped) }
            : AutocompleteFrequency.ApplyGrouped(grouped, options.Frequencies);

        // Score is the bucket-boosted (frequency + 1) × scale value — NOT the
        // result position — for both sort modes, matching the TS/Python/Go/PHP
        // reference. A single A→Z group has scale 1, so every alphabetical
        // suggestion scores frequency+1.
        var scoreOf = AutocompleteFrequency.ComputeScoreLookup(groups, options.Frequencies);

        var seen = new HashSet<string?>(StringComparer.Ordinal);
        var output = new List<Suggestion>(Math.Min(options.Limit, pool.Count));
        // Rank stays 1-based — the top result is Rank=1 — matching the shipped
        // Suggestion contract documented in Suggestion.cs. Only the score
        // changes in this fix; the rank base is unchanged.
        var rank = 0;
        foreach (var concept in groups.SelectMany(g => g))
        {
            if (output.Count >= options.Limit) break;
            var key = concept.Id ?? concept.InputText;
            if (!seen.Add(key)) continue;
            rank++;
            var span = AutocompleteSpan.Compute(concept.Name, queryUpper);
            var score = (double)scoreOf[AutocompleteFrequency.ScoreKey(concept)];
            output.Add(new Suggestion(concept, score, span, rank));
        }
        return Task.FromResult<IReadOnlyList<Suggestion>>(output);
    }
}

internal static class AutocompleteTokens
{
    private static readonly char[] Whitespace = new[] { ' ', '\t', '\n', '\r' };

    public static List<string> Tokenize(string text)
    {
        var raw = text.ToUpperInvariant().Split(Whitespace, StringSplitOptions.RemoveEmptyEntries);
        var words = new List<string>(raw.Length);
        foreach (var w in raw)
        {
            var stripped = StripNonAlnum(w);
            if (stripped.Length > 0) words.Add(stripped);
        }
        return words;
    }

    private static string StripNonAlnum(string s)
    {
        var buf = new char[s.Length];
        var n = 0;
        for (var i = 0; i < s.Length; i++)
        {
            var ch = s[i];
            if ((ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9'))
            {
                buf[n++] = ch;
            }
        }
        return n == 0 ? string.Empty : new string(buf, 0, n);
    }
}

internal static class AutocompleteSpan
{
    public static MatchedSpan Compute(string name, string queryUpper)
    {
        if (string.IsNullOrEmpty(queryUpper) || string.IsNullOrEmpty(name))
        {
            return new MatchedSpan(0, 0);
        }
        var upper = name.ToUpperInvariant();
        var idx = upper.IndexOf(queryUpper, StringComparison.Ordinal);
        return idx < 0 ? new MatchedSpan(0, 0) : new MatchedSpan(idx, queryUpper.Length);
    }
}
