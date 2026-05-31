// Typed sub-clients exposed under the top-level ZyInsClient. Each
// sub-client is a thin facade over HttpDispatcher; the dispatcher
// owns request building, signing, and error mapping.
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Isa.Sdk.Zyins;

// ── Flat wire body types (internal to this file) ─────────────────────────────

/// <summary>Flat 0.5.1 wire body for the prequalify endpoint.</summary>
internal sealed record PrequalifyWireBody(
    [property: System.Text.Json.Serialization.JsonPropertyName("date_of_birth")] string DateOfBirth,
    [property: System.Text.Json.Serialization.JsonPropertyName("gender")] string Gender,
    [property: System.Text.Json.Serialization.JsonPropertyName("height")] int Height,
    [property: System.Text.Json.Serialization.JsonPropertyName("weight")] int Weight,
    [property: System.Text.Json.Serialization.JsonPropertyName("state")] string State,
    [property: System.Text.Json.Serialization.JsonPropertyName("nicotine_usage")] NicotineUsageWire NicotineUsage,
    [property: System.Text.Json.Serialization.JsonPropertyName("products")] IReadOnlyList<string> Products,
    [property: System.Text.Json.Serialization.JsonPropertyName("conditions")] IReadOnlyList<ConditionWire> Conditions,
    [property: System.Text.Json.Serialization.JsonPropertyName("medications")] IReadOnlyList<MedicationWire> Medications,
    [property: System.Text.Json.Serialization.JsonPropertyName("quote_options")] QuoteOptionsWire QuoteOptions,
    [property: System.Text.Json.Serialization.JsonPropertyName("zip")] string? Zip = null);

internal sealed record NicotineUsageWire(
    [property: System.Text.Json.Serialization.JsonPropertyName("last_used")] string LastUsed,
    [property: System.Text.Json.Serialization.JsonPropertyName("product_usage")] IReadOnlyList<NicotineProductUsageWire>? ProductUsage = null);

internal sealed record NicotineProductUsageWire(
    [property: System.Text.Json.Serialization.JsonPropertyName("type")] string Type,
    [property: System.Text.Json.Serialization.JsonPropertyName("frequency")] string Frequency);

internal sealed record ConditionWire(
    [property: System.Text.Json.Serialization.JsonPropertyName("name")] string Name,
    [property: System.Text.Json.Serialization.JsonPropertyName("wasDiagnosed")] string WasDiagnosed,
    [property: System.Text.Json.Serialization.JsonPropertyName("lastTreatment")] string LastTreatment);

internal sealed record MedicationWire(
    [property: System.Text.Json.Serialization.JsonPropertyName("name")] string Name,
    [property: System.Text.Json.Serialization.JsonPropertyName("use")] string Use,
    [property: System.Text.Json.Serialization.JsonPropertyName("firstFill")] string FirstFill,
    [property: System.Text.Json.Serialization.JsonPropertyName("lastFill")] string LastFill);

internal sealed record QuoteOptionsWire(
    [property: System.Text.Json.Serialization.JsonPropertyName("amounts")] IReadOnlyList<string> Amounts,
    [property: System.Text.Json.Serialization.JsonPropertyName("quote_type")] string QuoteType);

// ── Wire builder helpers ──────────────────────────────────────────────────────

internal static class PrequalifyWireBuilder
{
    private static readonly string[] NicotineDurationWire =
    [
        "never", "within_12_months", "12_to_24_months", "24_to_36_months",
        "36_to_48_months", "48_to_60_months", "over_60_months",
    ];

    internal static PrequalifyWireBody Build(PrequalifyInput input)
    {
        var applicant = input.Applicant;
        var nicotine = ResolveNicotine(applicant);
        var quoteType = input.Coverage.MonthlyBudget.HasValue ? "monthly_budget" : "face_amounts";
        var amount = (input.Coverage.FaceValue ?? input.Coverage.MonthlyBudget ?? 0).ToString();

        return new PrequalifyWireBody(
            DateOfBirth:    applicant.Dob,
            Gender:         applicant.Sex == Sex.Male ? "male" : "female",
            Height:         applicant.HeightInches,
            Weight:         applicant.WeightPounds,
            State:          applicant.State,
            NicotineUsage:  nicotine,
            Products:       input.Products.Select(p => p.Token).ToArray(),
            Conditions:     applicant.Conditions.Select(c => new ConditionWire(c.Name, c.WasDiagnosed, c.LastTreatment)).ToArray(),
            Medications:    applicant.Medications.Select(m => new MedicationWire(m.Name, m.Use, m.FirstFill, m.LastFill)).ToArray(),
            QuoteOptions:   new QuoteOptionsWire([amount], quoteType),
            Zip:            applicant.Zip);
    }

    private static NicotineUsageWire ResolveNicotine(Applicant applicant)
    {
        if (applicant.NicotineUse is { } input)
        {
            var lastUsed = NicotineDurationWire[(int)input.LastUsed];
            var productUsage = input.ProductUsage.Count > 0
                ? input.ProductUsage.Select(p => new NicotineProductUsageWire(p.Type, p.Frequency)).ToArray()
                : null;
            return new NicotineUsageWire(lastUsed, productUsage);
        }
#pragma warning disable CS0618
        var bucket = applicant.NicotineUseLegacy switch
        {
            NicotineUsage.None    => "never",
            NicotineUsage.Current => "within_12_months",
            NicotineUsage.Former  => "12_to_24_months",
            _                     => "never",
        };
#pragma warning restore CS0618
        return new NicotineUsageWire(bucket);
    }
}

/// <summary>Sub-client for prequalification operations.</summary>
public sealed class PrequalifySubClient
{
    private const string Path = "/v1/prequalify";
    private readonly OperationContext _ctx;

    internal PrequalifySubClient(OperationContext ctx) => _ctx = ctx;

    /// <summary>
    /// Run the prequalify decision for an applicant against the available products.
    /// Builds the wire body, derives the idempotency key, signs the request,
    /// and parses the response into typed plans.
    /// </summary>
    /// <param name="input">Applicant demographics, coverage shape, products to evaluate.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>
    /// A <see cref="PrequalifyResult"/> containing the qualifying plans, the engine
    /// request id, the SDK-derived idempotency key, and the retry-attempts count.
    /// </returns>
    /// <exception cref="ZyInsException">on 4xx/5xx wire responses (typed by code).</exception>
    /// <example>
    /// <code>
    /// var result = await isa.Prequalify.RunAsync(new PrequalifyInput
    /// {
    ///     Applicant = new Applicant
    ///     {
    ///         Name         = "John Doe",
    ///         Dob          = "1962-04-18",
    ///         Sex          = Sex.Male,
    ///         State        = "NC",
    ///         HeightInches = 70,
    ///         WeightLbs    = 195,
    ///         NicotineUse  = NicotineUsage.None,
    ///     },
    ///     Coverage   = Coverage.FaceValue(25_000),
    ///     Products   = new[] { "senior-life" },
    /// });
    /// </code>
    /// </example>
    /// <seealso href="https://docs.isaapi.com/zyins/prequalify"/>
    public Task<PrequalifyResult> RunAsync(PrequalifyInput input, CancellationToken ct = default)
    {
        if (input is null) throw new ArgumentNullException(nameof(input));
        var wire = PrequalifyWireBuilder.Build(input);
        return HttpDispatcher.PostJsonAsync<PrequalifyWireBody, PrequalifyResult>(_ctx, Path, wire, ct);
    }

    /// <summary>Run prequalify and return the full JSON envelope.</summary>
    public Task<JsonObject> RunEnvelopeAsync(PrequalifyInput input, CancellationToken ct = default)
    {
        if (input is null) throw new ArgumentNullException(nameof(input));
        var useLegacyWire = LegacyWire.Enabled;
        if (useLegacyWire)
        {
            var body = LegacyWire.PrequalifyBodyFromApplicant(
                input.Applicant,
                LegacyWire.FaceAmountFromCoverage(input.Coverage));
            return HttpDispatcher.PostEnvelopeAsync(_ctx, Path, body, ct);
        }

        var wire = PrequalifyWireBuilder.Build(input);
        return HttpDispatcher.PostEnvelopeAsync(_ctx, Path, wire, ct);
    }

    /// <summary>Run a prequalify call and return the raw HTTP response alongside the parsed body.
    /// Useful for inspecting headers (e.g. <c>X-Isa-Request-Id</c>, rate-limit headers).</summary>
    public async Task<(PrequalifyResult Data, RawResponse Response)> WithRawResponseAsync(PrequalifyInput input, CancellationToken ct = default)
    {
        if (input is null) throw new ArgumentNullException(nameof(input));
        var wire = PrequalifyWireBuilder.Build(input);
        var (data, raw) = await HttpDispatcher.PostJsonRawAsync<PrequalifyWireBody, PrequalifyResult>(_ctx, Path, wire, ct).ConfigureAwait(false);
        return (data, RawResponse.FromTransport(raw, new Uri(_ctx.BaseUrl, Path)));
    }
}

/// <summary>Sub-client for quoting operations.</summary>
public sealed class QuoteSubClient
{
    private const string Path = "/v1/quote";
    private const string LegacyPath = "/v2/quote";
    private readonly OperationContext _ctx;

    internal QuoteSubClient(OperationContext ctx) => _ctx = ctx;

    /// <summary>Run a quote call.</summary>
    public Task<QuoteResult> RunAsync(QuoteInput input, CancellationToken ct = default)
    {
        if (input is null) throw new ArgumentNullException(nameof(input));
        return HttpDispatcher.PostJsonAsync<QuoteInput, QuoteResult>(_ctx, Path, input, ct);
    }

    /// <summary>Run quote and return the full JSON envelope.</summary>
    public Task<JsonObject> RunEnvelopeAsync(QuoteInput input, CancellationToken ct = default)
    {
        if (input is null) throw new ArgumentNullException(nameof(input));
        var useLegacyWire = LegacyWire.Enabled;
        if (useLegacyWire)
        {
            var body = LegacyWire.QuoteBodyFromApplicant(
                input.Applicant,
                LegacyWire.FaceAmountFromCoverage(input.Coverage));
            return HttpDispatcher.PostEnvelopeAsync(_ctx, LegacyPath, body, ct);
        }

        return HttpDispatcher.PostEnvelopeAsync(_ctx, Path, input, ct);
    }

    /// <summary>Run a quote call and return the raw HTTP response alongside the parsed body.</summary>
    public async Task<(QuoteResult Data, RawResponse Response)> WithRawResponseAsync(QuoteInput input, CancellationToken ct = default)
    {
        if (input is null) throw new ArgumentNullException(nameof(input));
        var (data, raw) = await HttpDispatcher.PostJsonRawAsync<QuoteInput, QuoteResult>(_ctx, Path, input, ct).ConfigureAwait(false);
        return (data, RawResponse.FromTransport(raw, new Uri(_ctx.BaseUrl, Path)));
    }
}

/// <summary>Sub-client for dataset discovery and retrieval.</summary>
public sealed class DatasetsSubClient
{
    private const string ListPath = "/v1/datasets";
    private readonly OperationContext _ctx;

    internal DatasetsSubClient(OperationContext ctx) => _ctx = ctx;

    /// <summary>List all available datasets for this account.</summary>
    public Task<IReadOnlyList<DatasetSummary>> ListAsync(CancellationToken ct = default) =>
        HttpDispatcher.GetAsync<IReadOnlyList<DatasetSummary>>(_ctx, ListPath, ct: ct);

    /// <summary>Retrieve a dataset by id.</summary>
    public Task<Dataset> GetAsync(string id, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(id))
            throw new ArgumentException("id must be non-empty", nameof(id));
        return HttpDispatcher.GetAsync<Dataset>(_ctx, $"{ListPath}/{Uri.EscapeDataString(id)}", ct: ct);
    }
}

/// <summary>Sub-client for reference data (conditions, medications, products, ...).</summary>
public sealed class ReferenceDataSubClient
{
    private const string PathBase = "/v1/reference-data";
    private readonly OperationContext _ctx;

    internal ReferenceDataSubClient(OperationContext ctx) => _ctx = ctx;

    /// <summary>Fetch a reference-data block by kind (e.g. <c>conditions</c>, <c>medications</c>).</summary>
    public Task<ReferenceDataResponse> GetAsync(string kind, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(kind))
            throw new ArgumentException("kind must be non-empty", nameof(kind));
        return HttpDispatcher.GetAsync<ReferenceDataResponse>(_ctx, $"{PathBase}/{Uri.EscapeDataString(kind)}", ct: ct);
    }
}

/// <summary>Sub-client providing a memoized product catalog fetched from the server once
/// and cached for subsequent calls.</summary>
public sealed class ProductsSubClient
{
    private const string Path = "/v1/datasets";
    private readonly OperationContext _ctx;
    private readonly SemaphoreSlim _lock = new(1, 1);
    private ProductCatalog? _catalog;

    internal ProductsSubClient(OperationContext ctx) => _ctx = ctx;

    /// <summary>Return the cached product catalog, fetching it on the first call.</summary>
    public async Task<ProductCatalog> CatalogAsync(CancellationToken ct = default)
    {
        if (_catalog is { } cached) return cached;
        await _lock.WaitAsync(ct).ConfigureAwait(false);
        try
        {
            if (_catalog is { } c) return c;
            _catalog = await FetchCatalogAsync(ct).ConfigureAwait(false);
            return _catalog;
        }
        finally { _lock.Release(); }
    }

    /// <summary>Discard the cached catalog and fetch a fresh copy.</summary>
    public async Task<ProductCatalog> RefreshAsync(CancellationToken ct = default)
    {
        await _lock.WaitAsync(ct).ConfigureAwait(false);
        try
        {
            _catalog = null;
            _catalog = await FetchCatalogAsync(ct).ConfigureAwait(false);
            return _catalog;
        }
        finally { _lock.Release(); }
    }

    private async Task<ProductCatalog> FetchCatalogAsync(CancellationToken ct)
    {
        var raw = await HttpDispatcher.PostJsonAsync<object, JsonElement>(
            _ctx, Path, new { datasets = new[] { "products" } }, ct).ConfigureAwait(false);
        var dict = new Dictionary<string, object?>();
        if (raw.ValueKind == JsonValueKind.Object)
        {
            foreach (var prop in raw.EnumerateObject())
                dict[prop.Name] = prop.Value;
        }
        return ProductCatalog.FromDatasets(dict);
    }
}

/// <summary>Sub-client for usage / billing.</summary>
public sealed class UsageSubClient
{
    private const string Path = "/v1/usage";
    private readonly OperationContext _ctx;

    internal UsageSubClient(OperationContext ctx) => _ctx = ctx;

    /// <summary>Get the usage summary for a billing period (e.g. <c>2026-05</c>).</summary>
    public Task<UsageSummary> SummaryAsync(string period, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(period))
            throw new ArgumentException("period must be non-empty", nameof(period));
        var q = new Dictionary<string, string?> { ["period"] = period };
        return HttpDispatcher.GetAsync<UsageSummary>(_ctx, Path, q, ct);
    }
}
