// Typed sub-clients exposed under the top-level ZyInsClient. Each
// sub-client is a thin facade over HttpDispatcher; the dispatcher
// owns request building, signing, and error mapping.
namespace Sah.Sdk.Zyins;

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
        return HttpDispatcher.PostJsonAsync<PrequalifyInput, PrequalifyResult>(_ctx, Path, input, ct);
    }

    /// <summary>Run a prequalify call and return the raw HTTP response alongside the parsed body.
    /// Useful for inspecting headers (e.g. <c>X-Isa-Request-Id</c>, rate-limit headers).</summary>
    public async Task<(PrequalifyResult Data, RawResponse Response)> WithRawResponseAsync(PrequalifyInput input, CancellationToken ct = default)
    {
        if (input is null) throw new ArgumentNullException(nameof(input));
        var (data, raw) = await HttpDispatcher.PostJsonRawAsync<PrequalifyInput, PrequalifyResult>(_ctx, Path, input, ct).ConfigureAwait(false);
        return (data, RawResponse.FromTransport(raw, new Uri(_ctx.BaseUrl, Path)));
    }

    /// <summary>Raw-blob variant of <see cref="RunAsync"/>. Accepts a pre-encoded
    /// prequalify payload (the wire shape produced by bpp2.0's <c>prepEncObj</c> /
    /// <c>prepEncObjV2</c> encoders) verbatim and reuses the rest of the
    /// prequalify transport — auth headers, idempotency-key derivation, error
    /// funnel, response parsing.
    ///
    /// The server accepts both the typed and legacy-blob shapes on the same
    /// <c>/v1/prequalify</c> path. This entry point exists so consumers do not
    /// have to restructure their encoder to take advantage of the SDK transport.
    /// </summary>
    /// <param name="encodedPayload">The pre-encoded prequalify payload. Serialized
    /// to JSON verbatim and sent as the request body.</param>
    /// <param name="ct">Cancellation token.</param>
    public Task<PrequalifyResult> LegacyBlobAsync(
        IReadOnlyDictionary<string, object?> encodedPayload,
        CancellationToken ct = default)
    {
        if (encodedPayload is null) throw new ArgumentNullException(nameof(encodedPayload));
        return HttpDispatcher.PostJsonAsync<IReadOnlyDictionary<string, object?>, PrequalifyResult>(
            _ctx, Path, encodedPayload, ct);
    }
}

/// <summary>Sub-client for quoting operations.</summary>
public sealed class QuoteSubClient
{
    private const string Path = "/v1/quote";
    private readonly OperationContext _ctx;

    internal QuoteSubClient(OperationContext ctx) => _ctx = ctx;

    /// <summary>Run a quote call.</summary>
    public Task<QuoteResult> RunAsync(QuoteInput input, CancellationToken ct = default)
    {
        if (input is null) throw new ArgumentNullException(nameof(input));
        return HttpDispatcher.PostJsonAsync<QuoteInput, QuoteResult>(_ctx, Path, input, ct);
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
