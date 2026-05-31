// <c>Isa.Sdk.Zyins.Reference.IMatchAlgorithm</c> — text → single
// <see cref="IConcept"/> resolver. Default impl uses the canonical
// <c>MakeKey</c> normalizer (ASCII uppercase + alphanumeric strip) and
// an exact lookup against the candidate set.
//
// Consumers swap algorithms via
// <c>IsaBuilder.WithMatchAlgorithm(custom)</c>; the SDK threads the
// override through every <c>Match*</c> call site.
using System.Collections.Generic;

namespace Isa.Sdk.Zyins.Reference;

/// <summary>Resolve a free-text query against a candidate set. Mirrors
/// the canonical TS interface (deferred to 1.x). Implementations MUST
/// return an unknown handle on miss — never throw.</summary>
/// <example>
/// <code>
/// var algo = new DefaultMatchAlgorithm();
/// var hit = algo.Match("hbp", index.AllConditions());
/// </code>
/// </example>
public interface IMatchAlgorithm
{
    /// <summary>Resolve <paramref name="query"/> against the
    /// <paramref name="candidates"/> set. Returns the matched candidate
    /// or an unknown handle preserving <paramref name="query"/> verbatim.</summary>
    IConcept Match(string query, IReadOnlyCollection<IConcept> candidates);

    /// <summary>Dataset version this adapter is bound to. <c>null</c>
    /// when the adapter is dataset-agnostic.</summary>
    string? VersionTag { get; }
}
