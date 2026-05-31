// `Isa.Sdk.Zyins.Reference.Reference` — facade for the typed catalog
// surface. Mirrors `isa.zyins.reference` in the canonical TS SDK
// (`packages/ts/src/zyins/reference.ts`).
//
// Public surface:
//
//     var bundle = await isa.Zyins.DatasetsV3.GetAsync();
//     var hbp = Reference.Conditions.Match("hbp", bundle.Bundle!);
//     foreach (var med in hbp.Medications())             // MostCommonFirst
//     {
//         Console.WriteLine(med.Name);
//     }
//
// Tier-3 sugar:
//   - `Reference.Concepts.MatchMany(IEnumerable<string>, bundle)` — bulk match.
//   - `Reference.Medications.List(bundle)` / `Reference.Conditions.List(bundle)`
//     — every entity in the catalog as a typed handle.
//
// Suggest / Frequency are intentionally deferred — the locked design
// keeps the v0.5.x surface tight and ships them in the next minor.

using System;
using System.Collections.Generic;

namespace Isa.Sdk.Zyins.Reference;

/// <summary>Matcher for a single catalog axis (medications, conditions,
/// or either). Never throws on a miss.</summary>
public interface IConceptMatcher
{
    /// <summary>Resolve <paramref name="text"/> against the catalog. On a
    /// miss returns an unknown handle (<see cref="IConcept.IsKnown"/> =
    /// <c>false</c>, <see cref="IConcept.Id"/> = <c>null</c>,
    /// <see cref="IConcept.InputText"/> preserved verbatim).</summary>
    IConcept Match(string text, DatasetBundleV3 bundle);
}

/// <summary>Matcher specialized to the medication catalog.</summary>
public interface IMedicationMatcher : IConceptMatcher
{
    /// <summary>List every medication in the catalog as a typed handle,
    /// in server-supplied order. Tier-3 sugar.</summary>
    IReadOnlyList<IMedicationConcept> List(DatasetBundleV3 bundle);
}

/// <summary>Matcher specialized to the condition catalog.</summary>
public interface IConditionMatcher : IConceptMatcher
{
    /// <summary>List every condition in the catalog as a typed handle,
    /// in server-supplied order. Tier-3 sugar.</summary>
    IReadOnlyList<IConditionConcept> List(DatasetBundleV3 bundle);
}

/// <summary>Matcher across both catalog axes (conditions first, then
/// medications — the typical "user typed a symptom" case).</summary>
public interface IAnyConceptMatcher : IConceptMatcher
{
    /// <summary>Bulk match. Each text resolves independently; unknown
    /// texts produce unknown handles inline so positional alignment
    /// with the input list is preserved. Tier-3 sugar.</summary>
    IReadOnlyList<IConcept> MatchMany(IEnumerable<string> texts, DatasetBundleV3 bundle);
}

/// <summary>Instance-shaped view of the <see cref="Reference"/> static
/// facade. Exposed on <c>ZyInsClient.Reference</c> so consumers can
/// write <c>isa.Zyins.Reference.Medications.Match(text, bundle)</c>
/// without reaching into a static class.</summary>
public interface IReferenceFacade
{
    /// <summary>Free-text → medication concept.</summary>
    IMedicationMatcher Medications { get; }
    /// <summary>Free-text → condition concept.</summary>
    IConditionMatcher Conditions { get; }
    /// <summary>Free-text → concept across both axes.</summary>
    IAnyConceptMatcher Concepts { get; }
}

internal sealed class ReferenceFacade : IReferenceFacade
{
    public static readonly IReferenceFacade Instance = new ReferenceFacade();
    private ReferenceFacade() { }
    public IMedicationMatcher Medications => Reference.Medications;
    public IConditionMatcher Conditions => Reference.Conditions;
    public IAnyConceptMatcher Concepts => Reference.Concepts;
}

/// <summary>The `isa.zyins.reference` namespace. Static facade — every
/// call accepts the bundle the consumer fetched from
/// <c>isa.Zyins.DatasetsV3.GetAsync()</c>. The SDK caches an internal
/// <see cref="ReferenceIndex"/> per bundle instance so the indexing
/// cost is paid once per dataset version.</summary>
public static class Reference
{
    /// <summary>Free-text → <see cref="IMedicationConcept"/>.</summary>
    public static IMedicationMatcher Medications { get; } = new MedicationsMatcher();

    /// <summary>Free-text → <see cref="IConditionConcept"/>.</summary>
    public static IConditionMatcher Conditions { get; } = new ConditionsMatcher();

    /// <summary>Free-text → <see cref="IConcept"/> across both axes
    /// (conditions tried first).</summary>
    public static IAnyConceptMatcher Concepts { get; } = new AnyConceptMatcher();
}

// ────────────────────────────────────────────────────────────────────────
// Matcher implementations.
// ────────────────────────────────────────────────────────────────────────

internal sealed class MedicationsMatcher : IMedicationMatcher
{
    public IConcept Match(string text, DatasetBundleV3 bundle)
    {
        if (text is null) throw new ArgumentNullException(nameof(text));
        if (bundle is null) throw new ArgumentNullException(nameof(bundle));
        var index = ReferenceIndex.ForBundle(bundle);
        var key = MakeKey.Normalize(text);
        if (key.Length > 0 && index.HasMedication(key))
        {
            return Concept.Medication(index, key, text);
        }
        return Concept.Unknown(text);
    }

    public IReadOnlyList<IMedicationConcept> List(DatasetBundleV3 bundle)
    {
        if (bundle is null) throw new ArgumentNullException(nameof(bundle));
        var index = ReferenceIndex.ForBundle(bundle);
        var items = bundle.Medications.Items;
        var built = new List<IMedicationConcept>(items.Count);
        foreach (var row in items)
        {
            built.Add(Concept.Medication(index, row.Id, row.Name));
        }
        return built;
    }
}

internal sealed class ConditionsMatcher : IConditionMatcher
{
    public IConcept Match(string text, DatasetBundleV3 bundle)
    {
        if (text is null) throw new ArgumentNullException(nameof(text));
        if (bundle is null) throw new ArgumentNullException(nameof(bundle));
        var index = ReferenceIndex.ForBundle(bundle);
        var key = MakeKey.Normalize(text);
        if (key.Length > 0 && index.HasCondition(key))
        {
            return Concept.Condition(index, key, text);
        }
        return Concept.Unknown(text);
    }

    public IReadOnlyList<IConditionConcept> List(DatasetBundleV3 bundle)
    {
        if (bundle is null) throw new ArgumentNullException(nameof(bundle));
        var index = ReferenceIndex.ForBundle(bundle);
        var items = bundle.Conditions.Items;
        var built = new List<IConditionConcept>(items.Count);
        foreach (var row in items)
        {
            built.Add(Concept.Condition(index, row.Id, row.Name));
        }
        return built;
    }
}

internal sealed class AnyConceptMatcher : IAnyConceptMatcher
{
    public IConcept Match(string text, DatasetBundleV3 bundle)
    {
        if (text is null) throw new ArgumentNullException(nameof(text));
        if (bundle is null) throw new ArgumentNullException(nameof(bundle));
        var index = ReferenceIndex.ForBundle(bundle);
        var key = MakeKey.Normalize(text);
        if (key.Length == 0) return Concept.Unknown(text);
        if (index.HasCondition(key)) return Concept.Condition(index, key, text);
        if (index.HasMedication(key)) return Concept.Medication(index, key, text);
        return Concept.Unknown(text);
    }

    public IReadOnlyList<IConcept> MatchMany(IEnumerable<string> texts, DatasetBundleV3 bundle)
    {
        if (texts is null) throw new ArgumentNullException(nameof(texts));
        if (bundle is null) throw new ArgumentNullException(nameof(bundle));
        var built = new List<IConcept>();
        foreach (var t in texts)
        {
            built.Add(Match(t ?? string.Empty, bundle));
        }
        return built;
    }
}

// ────────────────────────────────────────────────────────────────────────
// `Concept` — sealed handle implementing `IConcept` and both marker
// interfaces. Marker assignment is decided at construction; the handle
// only ever implements one of `IMedicationConcept` / `IConditionConcept`
// at runtime via concrete subclasses so the static interface check on
// the public surface still discriminates correctly.
// ────────────────────────────────────────────────────────────────────────

internal abstract class Concept : IConcept
{
    private static readonly IReadOnlyList<IConditionConcept> EmptyConditions =
        Array.Empty<IConditionConcept>();
    private static readonly IReadOnlyList<IMedicationConcept> EmptyMedications =
        Array.Empty<IMedicationConcept>();

    protected Concept(string? id, string name, ConceptKind kind, bool isKnown, string inputText)
    {
        Id = id;
        Name = name;
        Kind = kind;
        IsKnown = isKnown;
        InputText = inputText;
    }

    public string? Id { get; }
    public string Name { get; }
    public ConceptKind Kind { get; }
    public bool IsKnown { get; }
    public string InputText { get; }

    public virtual IReadOnlyList<IConditionConcept> Conditions(Sort sort = Sort.MostCommonFirst)
        => EmptyConditions;

    public virtual IReadOnlyList<IMedicationConcept> Medications(Sort sort = Sort.MostCommonFirst)
        => EmptyMedications;

    public bool Equals(IConcept? other)
    {
        if (other is null) return false;
        if (Kind != other.Kind) return false;
        if (IsKnown != other.IsKnown) return false;
        if (!IsKnown)
        {
            // Two unknown handles equate only when their input text is
            // identical — there's no opaque id to compare on.
            return string.Equals(InputText, other.InputText, StringComparison.Ordinal);
        }
        return string.Equals(Id, other.Id, StringComparison.Ordinal);
    }

    public override bool Equals(object? obj) => obj is IConcept other && Equals(other);

    public override int GetHashCode()
    {
        unchecked
        {
            var h = (int)Kind * 397;
            h ^= IsKnown ? 1 : 0;
            h = (h * 397) ^ (IsKnown ? (Id?.GetHashCode() ?? 0) : (InputText?.GetHashCode() ?? 0));
            return h;
        }
    }

    public static IMedicationConcept Medication(ReferenceIndex index, string id, string inputText)
        => new MedicationConcept(index, id, inputText);

    public static IConditionConcept Condition(ReferenceIndex index, string id, string inputText)
        => new ConditionConcept(index, id, inputText);

    public static IConcept Unknown(string inputText) => new UnknownConcept(inputText);

    // ── Internal sort helpers — pure functions over the id list. ────────

    protected static List<string> OrderByFrequency(
        IReadOnlyList<string> ids,
        Func<string, int> frequency)
    {
        // Stable: tie-break by original input index (server display order).
        var indexed = new (string Id, int Index, int Freq)[ids.Count];
        for (var i = 0; i < ids.Count; i++)
        {
            indexed[i] = (ids[i], i, frequency(ids[i]));
        }
        Array.Sort(indexed, (a, b) =>
        {
            var cmp = b.Freq.CompareTo(a.Freq);
            return cmp != 0 ? cmp : a.Index.CompareTo(b.Index);
        });
        var result = new List<string>(ids.Count);
        for (var i = 0; i < indexed.Length; i++) result.Add(indexed[i].Id);
        return result;
    }

    protected static List<string> OrderByName(
        IReadOnlyList<string> ids,
        Func<string, string?> nameOf)
    {
        var indexed = new (string Id, int Index, string Name)[ids.Count];
        for (var i = 0; i < ids.Count; i++)
        {
            indexed[i] = (ids[i], i, nameOf(ids[i]) ?? ids[i]);
        }
        Array.Sort(indexed, (a, b) =>
        {
            var cmp = string.Compare(a.Name, b.Name, StringComparison.InvariantCulture);
            return cmp != 0 ? cmp : a.Index.CompareTo(b.Index);
        });
        var result = new List<string>(ids.Count);
        for (var i = 0; i < indexed.Length; i++) result.Add(indexed[i].Id);
        return result;
    }
}

internal sealed class MedicationConcept : Concept, IMedicationConcept
{
    private readonly ReferenceIndex _index;
    private readonly string _id;
    private readonly string _inputText;

    public MedicationConcept(ReferenceIndex index, string id, string inputText)
        : base(id, index.MedicationName(id) ?? inputText, ConceptKind.Medication, isKnown: true, inputText)
    {
        _index = index;
        _id = id;
        _inputText = inputText;
    }

    public override IReadOnlyList<IConditionConcept> Conditions(Sort sort = Sort.MostCommonFirst)
    {
        var ids = _index.ConditionsForMedication(_id);
        if (ids.Count == 0) return Array.Empty<IConditionConcept>();
        var ordered = sort == Sort.Alphabetical
            ? OrderByName(ids, cid => _index.ConditionName(cid))
            : OrderByFrequency(ids, cid => _index.ConditionFrequencyForMedication(_id, cid));
        var built = new List<IConditionConcept>(ordered.Count);
        foreach (var cid in ordered)
        {
            if (!_index.HasCondition(cid)) continue;
            built.Add(new ConditionConcept(_index, cid, _inputText));
        }
        return built;
    }
}

internal sealed class ConditionConcept : Concept, IConditionConcept
{
    private readonly ReferenceIndex _index;
    private readonly string _id;
    private readonly string _inputText;

    public ConditionConcept(ReferenceIndex index, string id, string inputText)
        : base(id, index.ConditionName(id) ?? inputText, ConceptKind.Condition, isKnown: true, inputText)
    {
        _index = index;
        _id = id;
        _inputText = inputText;
    }

    public override IReadOnlyList<IMedicationConcept> Medications(Sort sort = Sort.MostCommonFirst)
    {
        var ids = _index.MedicationsForCondition(_id);
        if (ids.Count == 0) return Array.Empty<IMedicationConcept>();
        var ordered = sort == Sort.Alphabetical
            ? OrderByName(ids, mid => _index.MedicationName(mid))
            : OrderByFrequency(ids, mid => _index.ConditionFrequencyForMedication(mid, _id));
        var built = new List<IMedicationConcept>(ordered.Count);
        foreach (var mid in ordered)
        {
            if (!_index.HasMedication(mid)) continue;
            built.Add(new MedicationConcept(_index, mid, _inputText));
        }
        return built;
    }
}

internal sealed class UnknownConcept : Concept
{
    public UnknownConcept(string inputText)
        : base(id: null, name: inputText, kind: ConceptKind.Unknown, isKnown: false, inputText)
    {
    }
}
