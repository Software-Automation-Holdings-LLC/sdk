// Inline-row v3 datasets data model — locked in `/v3/datasets` rc.1 spec §1.
//
// The wire shape ships every relation INSIDE each row: a condition row
// carries its <c>treated_with[]</c> medications inline; a medication row
// carries its <c>used_for[]</c> conditions inline. No response-root maps,
// no client-side joins, no key normalization. Items are pre-sorted by the
// server (descending <c>prescription_count</c>, ties alphabetical ascending).
//
// Locked invariants:
//   - Every row has an <c>object</c> discriminator and a kind-prefixed
//     ULID <c>id</c> (<c>cond_</c>, <c>med_</c>, <c>nic_</c>, <c>spl_</c>).
//   - <c>SpellingCorrections</c> ships as a dataset of <c>{from, to}</c>
//     rows; this is the typoMap source for <see cref="Isa.Sdk.Zyins.Reference.DefaultAutocorrector"/>.
//   - Engine-side aliases / drug-equivalences / SpellingTable are NOT
//     on the wire (engine-only per spec §1 forbidden patterns).
using System.Collections.Generic;

namespace Isa.Sdk.Zyins;

/// <summary>A medication appearing inline on a condition row (the
/// <c>treated_with[]</c> array). Carries enough to render a UI row
/// without a second lookup: id, display name, and the server-supplied
/// prescription frequency the sort uses.</summary>
/// <example>
/// <code>
/// var hbp = bundle.Conditions[0];
/// foreach (var med in hbp.TreatedWith)
///     System.Console.WriteLine($"{med.Name} ({med.PrescriptionCount})");
/// </code>
/// </example>
public sealed record InlineMedicationRef(string Id, string Name, int PrescriptionCount);

/// <summary>A condition appearing inline on a medication row (the
/// <c>used_for[]</c> array). Symmetric to <see cref="InlineMedicationRef"/>.</summary>
public sealed record InlineConditionRef(string Id, string Name, int PrescriptionCount);

/// <summary>A condition catalog row with the medications used to treat
/// it inlined. Pre-sorted by descending <see cref="InlineMedicationRef.PrescriptionCount"/>.</summary>
/// <example>
/// <code>
/// var cond = bundle.Conditions.First(c => c.Name == "High Blood Pressure");
/// var topMed = cond.TreatedWith[0];
/// </code>
/// </example>
public sealed record ConditionRow(
    string Id,
    string Name,
    IReadOnlyList<InlineMedicationRef> TreatedWith
);

/// <summary>A medication catalog row with the conditions it treats
/// inlined. Pre-sorted by descending <see cref="InlineConditionRef.PrescriptionCount"/>.</summary>
public sealed record MedicationRow(
    string Id,
    string Name,
    IReadOnlyList<InlineConditionRef> UsedFor
);

/// <summary>A nicotine option row (cigarette, chewing tobacco, vape, ...).
/// The <c>Type</c> field discriminates smoked vs smokeless vs vapor —
/// downstream UIs use it to group the picker.</summary>
public sealed record NicotineOptionRow(string Id, string Name, string Type);

/// <summary>A spelling-correction row — one typo and its correction.
/// The <c>Isa.Sdk.Zyins.Reference.DefaultAutocorrector</c> projects
/// the rows of the <c>spelling_corrections</c> dataset into the typoMap it
/// applies on every keystroke.</summary>
/// <example>
/// <code>
/// var typoMap = bundle.SpellingCorrections
///     .ToDictionary(c =&gt; c.From, c =&gt; c.To);
/// var corrector = Isa.Autocorrector.Create(typoMap);
/// </code>
/// </example>
public sealed record SpellingCorrectionRow(string Id, string From, string To);

/// <summary>One named dataset within the v3 catalog. Generic over the
/// row type so the four supported datasets keep their concrete types
/// at the call site.</summary>
public sealed record DatasetEntry<TRow>(
    string Version,
    int ItemCount,
    IReadOnlyList<TRow> Items
);

/// <summary>Per-surface prescription-frequency graph derived locally
/// from the inline <c>treated_with</c> / <c>used_for</c> arrays. The
/// server no longer ships a response-root <c>frequency_graphs</c> map;
/// the SDK rebuilds the equivalent view on demand for callers that
/// need per-(condition,medication) lookups.</summary>
public sealed record FrequencyGraph(IReadOnlyDictionary<string, IReadOnlyDictionary<string, int>> UseMap);

/// <summary>
/// The v3 reference catalog — closed inline-row datasets. Pass to
/// <c>isa.Zyins.Reference.*</c> matchers or to
/// <c>Isa.Sdk.Zyins.Reference.DefaultAutocorrector</c>. Bundle equality
/// is by reference; a fresh <c>GET /v3/datasets</c> returns a new
/// instance and triggers any cache rebuilds.
/// </summary>
public sealed record DatasetBundleV3(
    string CatalogVersion,
    DatasetEntry<ConditionRow> Conditions,
    DatasetEntry<MedicationRow> Medications,
    DatasetEntry<NicotineOptionRow> NicotineOptions,
    DatasetEntry<SpellingCorrectionRow> SpellingCorrections,
    string? Etag,
    // The parser always supplies a non-null (possibly empty) collection for
    // these three slices — an omitted, null, or explicitly-empty field all
    // yield a present empty collection, byte-identical to the TS/Python/PHP
    // SDKs. The fields are therefore non-nullable: consumers read them without
    // a null branch.
    IReadOnlyDictionary<string, IReadOnlyList<ProductRef>> ProductsByFamily,
    IReadOnlyDictionary<string, long> DiscontinuedProducts,
    IReadOnlyList<string> StateDerivatives
);

/// <summary>A product appearing in a <c>products_by_family</c> slice —
/// the opaque <c>id</c> and its display <c>Name</c>. Consumers read the
/// slice directly rather than re-deriving family membership from flat
/// product rows.</summary>
public sealed record ProductRef(string Id, string Name);
