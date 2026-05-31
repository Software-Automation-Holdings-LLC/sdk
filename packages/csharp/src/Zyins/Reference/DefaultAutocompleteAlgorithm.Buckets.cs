// Bucketed categorization + frequency boost helpers for
// <see cref="DefaultAutocompleteAlgorithm"/>. Direct port of the JS
// web-worker logic in
// <c>bpp2.0/src/sah-ui/Input/TextField/useAutocomplete.js</c>.
//
// Each helper is a pure function over read-only inputs; the algorithm
// stays thread-safe and trivially testable.
using System;
using System.Collections.Generic;
using System.Linq;

namespace Isa.Sdk.Zyins.Reference;

internal static class AutocompleteFilter
{
    /// <summary>Pre-filter survivors by simple substring tests; mirrors
    /// the <c>filterOptions</c> step in the JS worker.</summary>
    public static List<IConcept> Filter(
        IReadOnlyCollection<IConcept> options,
        string queryUpper,
        IReadOnlyList<string> queryWords)
    {
        var survivors = new List<IConcept>();
        foreach (var option in options)
        {
            var upperName = (option.Name ?? string.Empty).ToUpperInvariant();
            if (queryWords.Count < 2)
            {
                if (upperName.IndexOf(queryUpper, StringComparison.Ordinal) >= 0)
                {
                    survivors.Add(option);
                }
                continue;
            }
            var matchedWords = 0;
            foreach (var word in queryWords)
            {
                if (upperName.IndexOf(word, StringComparison.Ordinal) >= 0) matchedWords++;
            }
            if (queryWords.Count - matchedWords <= 1)
            {
                survivors.Add(option);
            }
        }
        return survivors;
    }
}

internal sealed class Buckets
{
    public readonly List<IConcept> StartsWith = new();
    public readonly List<IConcept> SameWords = new();
    public readonly List<IConcept> IndependentWordIntersection = new();
    public readonly SortedDictionary<int, List<IConcept>> WordCountNoTolerance = new();
    public readonly List<IConcept> SameNumWithTolerance = new();
    public readonly SortedDictionary<int, List<IConcept>> WordCountWithTolerance = new();
}

internal static class AutocompleteBuckets
{
    public static Buckets Categorize(
        IReadOnlyList<IConcept> options,
        IReadOnlyList<string> queryWords,
        string queryUpper)
    {
        var queryWordSet = new HashSet<string>(queryWords, StringComparer.Ordinal);
        var buckets = new Buckets();
        foreach (var option in options)
        {
            var nameUpper = (option.Name ?? string.Empty).ToUpperInvariant();
            var optionWords = AutocompleteTokens.Tokenize(option.Name ?? string.Empty);
            var optionWordSet = new HashSet<string>(optionWords, StringComparer.Ordinal);

            var isStartMatch = nameUpper.StartsWith(queryUpper, StringComparison.Ordinal);
            var isSameLength = optionWords.Count == queryWords.Count;
            var lengthDiff = Math.Abs(queryWords.Count - optionWords.Count);
            var supersetOfInput = queryWords.All(w => optionWordSet.Contains(w));

            if (isStartMatch)
            {
                buckets.StartsWith.Add(option);
            }
            else if (isSameLength)
            {
                if (queryWordSet.Count == optionWordSet.Count
                    && queryWordSet.All(w => optionWordSet.Contains(w)))
                {
                    buckets.SameWords.Add(option);
                }
                else
                {
                    buckets.SameNumWithTolerance.Add(option);
                }
            }
            else
            {
                var target = supersetOfInput
                    ? buckets.WordCountNoTolerance
                    : buckets.WordCountWithTolerance;
                if (!target.TryGetValue(lengthDiff, out var list))
                {
                    list = new List<IConcept>();
                    target[lengthDiff] = list;
                }
                list.Add(option);
            }

            if (queryWords.All(w => nameUpper.IndexOf(w, StringComparison.Ordinal) >= 0))
            {
                buckets.IndependentWordIntersection.Add(option);
            }
        }
        return buckets;
    }

    public static List<List<IConcept>> Flatten(Buckets buckets)
    {
        var startsWithSorted = buckets.StartsWith
            .OrderBy(o => AutocompleteTokens.Tokenize(o.Name ?? string.Empty).Count)
            .ToList();
        var noTolFlat = buckets.WordCountNoTolerance.Values.SelectMany(v => v).ToList();
        var withTolFlat = buckets.WordCountWithTolerance.Values.SelectMany(v => v).ToList();
        return new List<List<IConcept>>
        {
            startsWithSorted,
            buckets.SameWords,
            noTolFlat,
            buckets.IndependentWordIntersection,
            buckets.SameNumWithTolerance,
            withTolFlat,
        };
    }
}

internal static class AutocompleteFrequency
{
    /// <summary>Within-bucket frequency boost, preserving the group structure
    /// so callers can compute each group's scale. Each bucket is sorted by
    /// <c>(frequency + 1) × scale</c> descending, ties by name. When no
    /// candidate has a frequency entry the boost is skipped and the groups are
    /// returned unchanged.</summary>
    public static List<List<IConcept>> ApplyGrouped(
        List<List<IConcept>> grouped,
        IReadOnlyDictionary<string, int>? frequencies)
    {
        if (frequencies is null || frequencies.Count == 0) return grouped;

        var anyHit = grouped.Any(g => g.Any(o => o.Id is { } id && frequencies.ContainsKey(id)));
        if (!anyHit) return grouped;

        var totalGroups = grouped.Count;
        var output = new List<List<IConcept>>(grouped.Count);
        for (var gi = 0; gi < grouped.Count; gi++)
        {
            var scale = Math.Max(1, totalGroups - gi);
            var sorted = grouped[gi]
                .Select(o =>
                {
                    var freq = (o.Id is { } id && frequencies.TryGetValue(id, out var f)) ? f : 0;
                    return new { Concept = o, Score = (freq + 1) * scale };
                })
                .OrderByDescending(x => x.Score)
                .ThenBy(x => x.Concept.Name, StringComparer.Ordinal)
                .Select(x => x.Concept)
                .ToList();
            output.Add(sorted);
        }
        return output;
    }

    /// <summary>Assign each candidate its bucket-boosted score
    /// <c>(frequency + 1) × scale</c>, where <c>scale = max(1, total − groupIndex)</c>
    /// and <c>total</c> is the number of groups. First occurrence of a key wins.
    /// This is the score consumers see on a Suggestion — a direct port of the
    /// TS/Python/Go ComputeScoreLookup, so a single A→Z group yields
    /// frequency+1 and the default mode's earlier buckets score higher.</summary>
    public static Dictionary<string, int> ComputeScoreLookup(
        List<List<IConcept>> groups,
        IReadOnlyDictionary<string, int>? frequencies)
    {
        var total = groups.Count;
        var lookup = new Dictionary<string, int>(StringComparer.Ordinal);
        for (var gi = 0; gi < groups.Count; gi++)
        {
            var scale = Math.Max(1, total - gi);
            foreach (var concept in groups[gi])
            {
                var key = ScoreKey(concept);
                if (lookup.ContainsKey(key)) continue;
                var freq = (concept.Id is { } id && frequencies is not null
                    && frequencies.TryGetValue(id, out var f)) ? f : 0;
                lookup[key] = (freq + 1) * scale;
            }
        }
        return lookup;
    }

    /// <summary>Per-candidate key for the score lookup — id when present, a
    /// name-derived fallback otherwise — mirroring the TS/Go reference so the
    /// same candidate scores identically across SDKs.</summary>
    public static string ScoreKey(IConcept concept) =>
        concept.Id ?? ("__unknown:" + concept.InputText);

    /// <summary>Collapse every relevance bucket into one case-insensitive
    /// A→Z list. The relevance filter already chose membership; this only
    /// changes ordering. De-dupes by id (first occurrence across buckets
    /// wins before the sort); ties break by case-sensitive name then id
    /// for stable, cross-language output.</summary>
    public static List<IConcept> FlattenAlphabetical(List<List<IConcept>> grouped)
    {
        var seen = new HashSet<string?>(StringComparer.Ordinal);
        var flat = new List<IConcept>();
        foreach (var group in grouped)
        {
            foreach (var concept in group)
            {
                var key = concept.Id ?? concept.InputText;
                if (!seen.Add(key)) continue;
                flat.Add(concept);
            }
        }
        return flat
            .OrderBy(c => c.Name, StringComparer.OrdinalIgnoreCase)
            .ThenBy(c => c.Name, StringComparer.Ordinal)
            .ThenBy(c => c.Id ?? string.Empty, StringComparer.Ordinal)
            .ToList();
    }
}
