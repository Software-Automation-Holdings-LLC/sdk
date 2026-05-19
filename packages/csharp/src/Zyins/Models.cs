// Public record types for the ZyINS prequalify / quote surface.
// Field names match the JS canonical surface in
// `packages/zyins/js/src/applicant.ts` and `prequalify.ts`. PascalCase
// here; the JsonSerializerContext in JsonSerialization.cs maps to the
// snake_case wire format the engine speaks.
using System.Text.Json.Serialization;

namespace Sah.Sdk.Zyins;

/// <summary>Applicant biological sex.</summary>
public enum Sex
{
    /// <summary>Male.</summary>
    Male,
    /// <summary>Female.</summary>
    Female,
}

/// <summary>Reported nicotine usage.</summary>
public enum NicotineUsage
{
    /// <summary>Never used nicotine.</summary>
    None,
    /// <summary>Currently using nicotine.</summary>
    Current,
    /// <summary>Formerly used nicotine.</summary>
    Former,
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

    /// <summary>US state of residence (two-letter postal code).</summary>
    public required string State { get; init; }

    /// <summary>ZIP code; required by some product families.</summary>
    public string? Zip { get; init; }

    /// <summary>Reported nicotine usage.</summary>
    public required NicotineUsage NicotineUse { get; init; }

    /// <summary>Optional medications; defaults to empty.</summary>
    public IReadOnlyList<Medication> Medications { get; init; } = Array.Empty<Medication>();

    /// <summary>Optional conditions; defaults to empty.</summary>
    public IReadOnlyList<Condition> Conditions { get; init; } = Array.Empty<Condition>();
}

/// <summary>Coverage spec — face value (in whole USD) or monthly budget (in whole USD/mo).</summary>
public sealed record Coverage
{
    /// <summary>Face value amount; mutually exclusive with <see cref="MonthlyBudget"/>.</summary>
    public int? FaceValue { get; init; }

    /// <summary>Monthly budget; mutually exclusive with <see cref="FaceValue"/>.</summary>
    public int? MonthlyBudget { get; init; }

    /// <summary>Construct a coverage spec by face value.</summary>
    public static Coverage ByFaceValue(int dollars) => new() { FaceValue = dollars };

    /// <summary>Construct a coverage spec by monthly budget.</summary>
    public static Coverage ByMonthlyBudget(int dollarsPerMonth) => new() { MonthlyBudget = dollarsPerMonth };
}

/// <summary>One product to consider in the underwriting run.</summary>
public sealed record Product(string Brand, string Token);

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
