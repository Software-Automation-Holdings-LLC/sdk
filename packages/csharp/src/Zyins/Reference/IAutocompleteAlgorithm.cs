// <c>Isa.Sdk.Zyins.Reference.IAutocompleteAlgorithm</c> — text →
// ranked <see cref="Suggestion"/> list. Default impl ports the bucketed
// algorithm from <c>bpp2.0/src/sah-ui/Input/TextField/useAutocomplete.js</c>.
//
// Buckets (highest → lowest):
//   1. startsWith — option starts with literal input (sub-sort by
//      option.wordCount ascending).
//   2. sameWords — identical word set + same word count.
//   3. wordCountNoTolerance[d] — option contains all input words +
//      d extras (sub-sort by d asc).
//   4. independentWordIntersection — every input word appears in option.
//   5. sameNumWithTolerance — same word count, different word sets.
//   6. wordCountWithTolerance[d] — d words differ/extra
//      (sub-sort by d asc).
//
// Within-bucket frequency boost: <c>score = (frequencies[id] + 1) ×
// max(1, totalGroups - groupIndex)</c>. Tied scores sort alphabetical.
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace Isa.Sdk.Zyins.Reference;

/// <summary>Options for <see cref="IAutocompleteAlgorithm.Rank"/>.
/// <c>Sort</c> selects the result ordering: <see cref="Sort.MostCommonFirst"/>
/// (default) keeps the bucketed relevance + frequency-boost order;
/// <see cref="Sort.Alphabetical"/> keeps the same relevance FILTER but emits
/// matches in a flat case-insensitive A→Z order by display name, for an A-Z
/// toggle in a narrowing UI.</summary>
public sealed record AutocompleteOptions(
    int Limit = 25,
    IReadOnlyCollection<ConceptKind>? Kinds = null,
    IReadOnlyDictionary<string, int>? Frequencies = null,
    Sort Sort = Sort.MostCommonFirst
);

/// <summary>Text → ranked <see cref="Suggestion"/> resolver. Tier-1
/// surface.</summary>
/// <example>
/// <code>
/// var algo = new DefaultAutocompleteAlgorithm();
/// var ranked = await algo.Rank(
///     query: "high blood",
///     candidates: bundle.Conditions.Items
///         .Select(c =&gt; Isa.Sdk.Zyins.Reference.Concept.Condition(index, c.Id, c.Name))
///         .ToList(),
///     options: new AutocompleteOptions(Limit: 10));
/// </code>
/// </example>
public interface IAutocompleteAlgorithm
{
    /// <summary>Rank <paramref name="candidates"/> against
    /// <paramref name="query"/>. Returns at most <c>options.Limit</c>
    /// suggestions, sorted highest score first. Empty query → empty
    /// list (never null).</summary>
    Task<IReadOnlyList<Suggestion>> Rank(
        string query,
        IReadOnlyCollection<IConcept> candidates,
        AutocompleteOptions options,
        CancellationToken ct = default);

    /// <summary>Dataset version this adapter is bound to. <c>null</c>
    /// when the adapter is dataset-agnostic.</summary>
    string? VersionTag { get; }
}
