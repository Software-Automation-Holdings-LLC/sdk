// Public record types for the ZyINS prequalify / quote surface.
// Field names match the JS canonical surface in
// `packages/zyins/js/src/applicant.ts` and `prequalify.ts`. PascalCase
// here; the JsonSerializerContext in JsonSerialization.cs maps to the
// snake_case wire format the engine speaks.
using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace Isa.Sdk.Zyins;

/// <summary>Applicant biological sex.</summary>
public enum Sex
{
    /// <summary>Male.</summary>
    Male,
    /// <summary>Female.</summary>
    Female,
}

/// <summary>Seven-bucket duration encoding for nicotine use history (0.5.1 wire).</summary>
public enum NicotineDuration
{
    /// <summary>Never used nicotine.</summary>
    Never,
    /// <summary>Used within the last 12 months.</summary>
    Within12Months,
    /// <summary>Used between 12 and 24 months ago.</summary>
    Months12To24,
    /// <summary>Used between 24 and 36 months ago.</summary>
    Months24To36,
    /// <summary>Used between 36 and 48 months ago.</summary>
    Months36To48,
    /// <summary>Used between 48 and 60 months ago.</summary>
    Months48To60,
    /// <summary>Used more than 60 months ago.</summary>
    Over60Months,
}

/// <summary>Frequency of use for a specific nicotine product type.</summary>
public sealed record NicotineProductUsage(string Type, string Frequency);

/// <summary>Structured nicotine usage input for the 0.5.1 wire format.
/// Prefer this over the deprecated <see cref="NicotineUsage"/> enum.</summary>
public sealed record NicotineUsageInput
{
    /// <summary>Duration bucket for the most recent nicotine use.</summary>
    public required NicotineDuration LastUsed { get; init; }

    /// <summary>Optional breakdown by product type.</summary>
    public IReadOnlyList<NicotineProductUsage> ProductUsage { get; init; } = Array.Empty<NicotineProductUsage>();
}

/// <summary>Reported nicotine usage (three-value enum).</summary>
/// <remarks>Deprecated: use <see cref="NicotineUsageInput"/> with <see cref="NicotineDuration"/>
/// constants instead. Will be removed in v0.7.0.</remarks>
[Obsolete("Use NicotineUsageInput with NicotineDuration constants. Will be removed in v0.7.0.")]
public enum NicotineUsage
{
    /// <summary>Never used nicotine.</summary>
    None,
    /// <summary>Currently using nicotine.</summary>
    Current,
    /// <summary>Formerly used nicotine.</summary>
    Former,
}

/// <summary>Quote type discriminator for the 0.5.1 wire.</summary>
public enum QuoteType
{
    /// <summary>Request coverage by death-benefit face value.</summary>
    FaceAmounts,
    /// <summary>Request coverage by monthly premium budget.</summary>
    MonthlyBudget,
}

/// <summary>Single medication on the applicant profile.</summary>
public sealed record Medication(
    string Name,
    string Use,
    string FirstFill,
    string LastFill);

/// <summary>Single medical condition on the applicant profile.</summary>
public sealed record Condition(
    string Name,
    string WasDiagnosed,
    string LastTreatment);

/// <summary>Applicant profile prequalify operates on.</summary>
public sealed record Applicant
{
    /// <summary>Date of birth as an ISO 8601 date (e.g. "1962-04-18").</summary>
    public required string Dob { get; init; }

    /// <summary>Biological sex.</summary>
    public required Sex Sex { get; init; }

    /// <summary>Total height in inches.</summary>
    public required int HeightInches { get; init; }

    /// <summary>Weight in pounds.</summary>
    public required int WeightPounds { get; init; }

    /// <summary>ISO 3166-2:US two-letter postal code (e.g. "NC").
    ///
    /// Prefer the typed catalog enum via
    /// <see cref="ApplicantExtensions.WithState"/> over the raw string
    /// initializer; the typed form rejects typos like "North Carolina"
    /// at compile time. Raw two-letter strings remain accepted for
    /// backward compatibility.</summary>
    public required string State { get; init; }

    /// <summary>ZIP code; required by some product families.</summary>
    public string? Zip { get; init; }

    /// <summary>Reported nicotine usage in structured 0.5.1 form.</summary>
    public NicotineUsageInput? NicotineUse { get; init; }

    /// <summary>Reported nicotine usage (legacy three-value enum).</summary>
    /// <remarks>Deprecated: set <see cref="NicotineUse"/> instead. Will be removed in v0.7.0.</remarks>
    [Obsolete("Use NicotineUse (NicotineUsageInput) instead. Will be removed in v0.7.0.")]
    public NicotineUsage NicotineUseLegacy { get; init; }

    /// <summary>Optional medications; defaults to empty.</summary>
    public IReadOnlyList<Medication> Medications { get; init; } = Array.Empty<Medication>();

    /// <summary>Optional conditions; defaults to empty.</summary>
    public IReadOnlyList<Condition> Conditions { get; init; } = Array.Empty<Condition>();
}

/// <summary>Idiotproof typed initializers for <see cref="Applicant"/>.
/// Pair the catalog enums (<c>Isa.Sdk.Catalog.State</c>) with the
/// record's <c>with</c> expression so callers never spell a state
/// string inline.</summary>
public static class ApplicantExtensions
{
    /// <summary>Return a copy of <paramref name="applicant"/> with
    /// <see cref="Applicant.State"/> set to the wire value of the
    /// typed catalog enum. Idiotproof: the compiler rejects typos.</summary>
    public static Applicant WithState(this Applicant applicant, global::Isa.Sdk.Catalog.State state)
        => applicant with { State = global::Isa.Sdk.Catalog.States.WireValue(state) };
}

/// <summary>Coverage spec — face value (in whole USD) or monthly budget (in whole USD/mo).</summary>
public sealed record Coverage
{
    /// <summary>Single face value amount; mutually exclusive with <see cref="MonthlyBudget"/> and the multi-amount fields.</summary>
    public int? FaceValue { get; init; }

    /// <summary>Single monthly budget; mutually exclusive with <see cref="FaceValue"/> and the multi-amount fields.</summary>
    public int? MonthlyBudget { get; init; }

    /// <summary>Several face values probed in one call; empty for a single-amount coverage.</summary>
    public IReadOnlyList<int> FaceValues { get; init; } = Array.Empty<int>();

    /// <summary>Several monthly budgets probed in one call; empty for a single-amount coverage.</summary>
    public IReadOnlyList<int> MonthlyBudgets { get; init; } = Array.Empty<int>();

    /// <summary>True when the coverage probes several amounts in one call.</summary>
    public bool IsMulti => FaceValues.Count > 0 || MonthlyBudgets.Count > 0;

    /// <summary>Construct a coverage spec by a single face value.</summary>
    public static Coverage ByFaceValue(int dollars) => new() { FaceValue = RequirePositive(dollars, nameof(ByFaceValue)) };

    /// <summary>Construct a coverage spec by a single monthly budget.</summary>
    public static Coverage ByMonthlyBudget(int dollarsPerMonth) => new() { MonthlyBudget = RequirePositive(dollarsPerMonth, nameof(ByMonthlyBudget)) };

    /// <summary>Probe several face-value (death-benefit) amounts in one call.</summary>
    public static Coverage ByFaceValues(IReadOnlyList<int> dollars) => new() { FaceValues = RequirePositive(dollars, nameof(ByFaceValues)) };

    /// <summary>Probe several monthly-premium ceilings in one call.</summary>
    public static Coverage ByMonthlyBudgets(IReadOnlyList<int> dollarsPerMonth) => new() { MonthlyBudgets = RequirePositive(dollarsPerMonth, nameof(ByMonthlyBudgets)) };

    private static int RequirePositive(int amount, string ctor)
    {
        if (amount <= 0) throw new ArgumentOutOfRangeException(nameof(amount), $"Coverage.{ctor}: amount must be positive");
        return amount;
    }

    private static IReadOnlyList<int> RequirePositive(IReadOnlyList<int> amounts, string ctor)
    {
        if (amounts is null || amounts.Count == 0)
            throw new ArgumentException($"Coverage.{ctor}: at least one amount required", nameof(amounts));
        foreach (var a in amounts)
        {
            if (a <= 0) throw new ArgumentOutOfRangeException(nameof(amounts), $"Coverage.{ctor}: amounts must be positive");
        }
        return amounts;
    }
}

/// <summary>One product to consider in the underwriting run.</summary>
public sealed record Product(string Brand, string Token);

/// <summary>Product type category.</summary>
public enum ProductType
{
    /// <summary>Final expense / burial insurance.</summary>
    FinalExpense,
    /// <summary>Term life insurance.</summary>
    Term,
    /// <summary>Whole life insurance.</summary>
    WholeLife,
    /// <summary>Medicare supplement.</summary>
    MedicareSupplement,
    /// <summary>Universal life.</summary>
    Universal,
    /// <summary>Indexed universal life.</summary>
    Indexed,
}

/// <summary>Full product entry with display metadata.</summary>
public sealed record ProductEntry(
    string Brand,
    ProductType Type,
    string WireToken,
    string DisplayName);

/// <summary>In-memory catalog of known products. Build via
/// <see cref="DefaultCatalog"/> or <see cref="FromDatasets"/>.</summary>
public sealed class ProductCatalog
{
    private readonly IReadOnlyList<ProductEntry> _products;

    private ProductCatalog(IReadOnlyList<ProductEntry> products) => _products = products;

    /// <summary>The static built-in catalog shipped with the SDK.</summary>
    public static ProductCatalog DefaultCatalog() => new(DefaultProducts());

    /// <summary>Build a catalog from a datasets bundle returned by the datasets endpoint.
    /// Entries missing required fields are silently skipped.</summary>
    public static ProductCatalog FromDatasets(IReadOnlyDictionary<string, object?> bundle)
    {
        if (!bundle.TryGetValue("products", out var raw) ||
            raw is not System.Text.Json.JsonElement elem ||
            elem.ValueKind != System.Text.Json.JsonValueKind.Object)
        {
            return new ProductCatalog(Array.Empty<ProductEntry>());
        }
        var products = new List<ProductEntry>();
        foreach (var kvp in elem.EnumerateObject())
        {
            if (kvp.Value.ValueKind != System.Text.Json.JsonValueKind.Array) continue;
            foreach (var entry in kvp.Value.EnumerateArray())
            {
                var p = RawEntryToProduct(entry);
                if (p is not null) products.Add(p);
            }
        }
        return new ProductCatalog(products);
    }

    /// <summary>Return the product matching brand and type, or throw.</summary>
    public ProductEntry Find(string brand, ProductType type) =>
        TryFind(brand, type) ?? throw new KeyNotFoundException(
            $"ProductCatalog.Find: no product matches brand={brand} type={type}");

    /// <summary>Return the product matching brand and type, or null.</summary>
    public ProductEntry? TryFind(string brand, ProductType type) =>
        _products.FirstOrDefault(p => p.Brand == brand && p.Type == type);

    /// <summary>Return the product matching the wire token slug, or throw.</summary>
    public ProductEntry FindBySlug(string slug) =>
        TryFindBySlug(slug) ?? throw new KeyNotFoundException(
            $"ProductCatalog.FindBySlug: no product matches slug={slug}");

    /// <summary>Return the product matching the wire token slug, or null.</summary>
    public ProductEntry? TryFindBySlug(string slug) =>
        _products.FirstOrDefault(p => p.WireToken == slug);

    /// <summary>All products in the catalog.</summary>
    public IReadOnlyList<ProductEntry> List() => _products;

    private static ProductEntry? RawEntryToProduct(System.Text.Json.JsonElement entry)
    {
        if (!entry.TryGetProperty("identifier", out var id) ||
            !entry.TryGetProperty("carrier", out var carrier) ||
            !entry.TryGetProperty("name", out var name))
            return null;
        var identifier = id.GetString();
        var carrierStr = carrier.GetString();
        var nameStr = name.GetString();
        if (string.IsNullOrEmpty(identifier) || string.IsNullOrEmpty(carrierStr) || string.IsNullOrEmpty(nameStr))
            return null;
        var cls = entry.TryGetProperty("product", out var prod) ? (prod.GetString() ?? "") : "";
        return new ProductEntry(carrierStr!, MapProductClass(cls), identifier!, nameStr!);
    }

    private static ProductType MapProductClass(string cls) =>
        cls.ToLowerInvariant() switch
        {
            "fex"                                    => ProductType.FinalExpense,
            "term"                                   => ProductType.Term,
            "wl" or "whole_life" or "wholelife"      => ProductType.WholeLife,
            "medsup" or "medicare_supplement"         => ProductType.MedicareSupplement,
            "ul" or "universal"                      => ProductType.Universal,
            "indexed"                                => ProductType.Indexed,
            _                                        => ProductType.FinalExpense,
        };

    private static IReadOnlyList<ProductEntry> DefaultProducts() =>
    [
        new("colonial-penn",  ProductType.FinalExpense,       "colonial-penn.final-expense",   "Colonial Penn Final Expense"),
        new("mutual-of-omaha",ProductType.FinalExpense,       "mutual-of-omaha.final-expense", "Mutual of Omaha Final Expense"),
        new("aetna",          ProductType.MedicareSupplement, "aetna.medicare-supplement",     "Aetna Medicare Supplement"),
    ];
}

/// <summary>Input to <see cref="ZyInsClient.Prequalify"/>.</summary>
public sealed record PrequalifyInput
{
    /// <summary>The applicant.</summary>
    public required Applicant Applicant { get; init; }

    /// <summary>The coverage spec.</summary>
    public required Coverage Coverage { get; init; }

    /// <summary>Products to consider; if empty, the engine considers every available product.</summary>
    public IReadOnlyList<Product> Products { get; init; } = Array.Empty<Product>();
}

/// <summary>One plan returned by the engine.</summary>
public sealed record PrequalifyPlan(
    string Brand,
    string Tier,
    double MonthlyPremium,
    int FaceValue,
    string ProductToken);

/// <summary>Output of <see cref="ZyInsClient.Prequalify"/>.</summary>
public sealed record PrequalifyResult(
    IReadOnlyList<PrequalifyPlan> Plans,
    string RequestId);

/// <summary>Input to <see cref="ZyInsClient.Quote"/>. Same shape as prequalify; the engine
/// distinguishes by endpoint.</summary>
public sealed record QuoteInput
{
    /// <summary>The applicant.</summary>
    public required Applicant Applicant { get; init; }

    /// <summary>The coverage spec.</summary>
    public required Coverage Coverage { get; init; }

    /// <summary>Products to quote.</summary>
    public IReadOnlyList<Product> Products { get; init; } = Array.Empty<Product>();
}

/// <summary>One priced quote.</summary>
public sealed record QuotePlan(
    string Brand,
    string Tier,
    double MonthlyPremium,
    int FaceValue,
    string ProductToken);

/// <summary>Output of <see cref="ZyInsClient.Quote"/>.</summary>
public sealed record QuoteResult(
    IReadOnlyList<QuotePlan> Plans,
    string RequestId);

/// <summary>Dataset descriptor returned by <c>/v1/datasets</c>.</summary>
public sealed record DatasetSummary(
    string Id,
    string Name,
    string Version,
    string PublishedAt);

/// <summary>Full dataset payload returned by <c>/v1/datasets/{id}</c>.</summary>
public sealed record Dataset(
    string Id,
    string Name,
    string Version,
    string PublishedAt,
    IReadOnlyList<string> Brands);

/// <summary>Reference-data response is intentionally untyped; the kind determines the schema.</summary>
public sealed record ReferenceDataResponse(
    string Kind,
    [property: JsonPropertyName("data")] System.Text.Json.JsonElement Data);

/// <summary>Usage summary for a billing period.</summary>
public sealed record UsageSummary(
    string Period,
    long PrequalifyCalls,
    long QuoteCalls,
    long TotalApiCalls);
