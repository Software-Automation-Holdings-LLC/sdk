// <c>DefaultMatchAlgorithm</c> — smart_cmp normalize-then-exact lookup.
//
// The default algorithm uppercases + strips non-alphanumerics via the
// canonical <c>MakeKey</c> normalizer (mirrors Go's
// <c>MakeKey</c> in <c>go/zyins/models/makekey.go</c>) and looks up the
// resulting key against the candidate set's <c>Id</c> field. Misses
// return an unknown handle preserving the original input verbatim.
//
// The candidate set is typically built by the SDK from a
// <see cref="DatasetBundleV3"/> via
// <see cref="ReferenceIndex.AllConditions"/> /
// <see cref="ReferenceIndex.AllMedications"/>. Custom adapters may
// derive candidates differently (e.g. fuzzy match against a remote
// index); the contract is the interface, not the candidate source.
using System;
using System.Collections.Generic;

namespace Isa.Sdk.Zyins.Reference;

/// <summary>Reference implementation of <see cref="IMatchAlgorithm"/>.
/// </summary>
public sealed class DefaultMatchAlgorithm : IMatchAlgorithm
{
    /// <summary>Construct with an optional version tag pinning the
    /// adapter to a specific catalog revision.</summary>
    public DefaultMatchAlgorithm(string? versionTag = null)
    {
        VersionTag = versionTag;
    }

    /// <inheritdoc/>
    public string? VersionTag { get; }

    /// <summary>Return a clone with selected fields overridden.</summary>
    public DefaultMatchAlgorithm Clone(string? versionTag = null) =>
        new(versionTag ?? VersionTag);

    /// <inheritdoc/>
    public IConcept Match(string query, IReadOnlyCollection<IConcept> candidates)
    {
        if (query is null) throw new ArgumentNullException(nameof(query));
        if (candidates is null) throw new ArgumentNullException(nameof(candidates));
        var key = MakeKey.Normalize(query);
        if (key.Length == 0) return Concept.Unknown(query);
        foreach (var candidate in candidates)
        {
            if (candidate.Id is { } id && string.Equals(id, key, StringComparison.Ordinal))
            {
                return candidate;
            }
        }
        return Concept.Unknown(query);
    }
}
