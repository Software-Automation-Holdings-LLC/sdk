// <c>Suggestion</c> — ranked output element from
// <see cref="IAutocompleteAlgorithm.Rank"/>. Carries the resolved
// <see cref="IConcept"/> alongside the per-suggestion score, matched
// span, and final rank.
//
// The record is a thin extension of <see cref="IConcept"/> — it
// composes rather than inherits so callers can read the underlying
// concept handle directly without an additional accessor.
namespace Isa.Sdk.Zyins.Reference;

/// <summary>The substring of the candidate's display name that matched
/// the query. <c>Start</c> + <c>Length</c> are byte offsets into the
/// candidate's <see cref="IConcept.Name"/>; downstream UIs use this to
/// bold the matched span. Both fields are 0 for non-positional bucket
/// matches (the default algorithm's <c>sameWords</c> /
/// <c>independentWordIntersection</c> / etc. buckets).</summary>
public sealed record MatchedSpan(int Start, int Length);

/// <summary>One ranked autocomplete suggestion. <c>Rank</c> is 1-based
/// (the top result is <c>Rank=1</c>). <c>Score</c> is the algorithm's
/// internal score, monotonically decreasing with <c>Rank</c>. <c>MatchedSpan</c>
/// describes the substring of <see cref="IConcept.Name"/> that matched
/// the query.</summary>
/// <example>
/// <code>
/// var algo = new DefaultAutocompleteAlgorithm();
/// var suggestions = await algo.Rank("hbp", candidates, new AutocompleteOptions(Limit: 10));
/// foreach (var s in suggestions)
///     System.Console.WriteLine($"{s.Rank}. {s.Concept.Name} (score {s.Score})");
/// </code>
/// </example>
public sealed record Suggestion(
    IConcept Concept,
    double Score,
    MatchedSpan MatchedSpan,
    int Rank
);
