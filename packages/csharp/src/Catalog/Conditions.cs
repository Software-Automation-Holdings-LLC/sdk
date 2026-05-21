// CATALOG-GEN: do not hand-edit; rerun packages/csharp/scripts/gen-catalog.mjs.
//
// Source data:
//   - insurance/v2_conditions.json
//   - insurance/v2_medications.json

using System;
using System.Collections.Generic;

namespace Sah.Sdk.Catalog;

/// <summary>Public metadata for a condition category.</summary>
public sealed record ConditionCategoryMetadata(
    string DisplayName,
    IReadOnlyList<string> Conditions);

/// <summary>Categories partition the canonical condition list into clinically
/// related groups. The engine's reference data does not currently expose a
/// stable category taxonomy; the catalog is intentionally empty today.</summary>
public static class ConditionCategories
{
    private static readonly IReadOnlyDictionary<string, ConditionCategoryMetadata> CATEGORIES =
        new Dictionary<string, ConditionCategoryMetadata>();

    /// <summary>Every category name. Empty today.</summary>
    public static IReadOnlyCollection<string> Values() => Array.Empty<string>();

    /// <summary>Metadata lookup; throws on unknown category.</summary>
    public static ConditionCategoryMetadata Metadata(string category)
    {
        if (category is null) throw new ArgumentNullException(nameof(category));
        if (!CATEGORIES.TryGetValue(category, out var m))
            throw new ArgumentException($"ConditionCategories.Metadata: unknown category '{category}'", nameof(category));
        return m;
    }
}
