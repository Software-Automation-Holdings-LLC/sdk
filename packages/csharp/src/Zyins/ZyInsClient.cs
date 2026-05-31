// Top-level ZyINS client. One-line construction with a bearer token:
//
//   using Isa.Sdk.Zyins;
//   var client = new ZyInsClient("isa_live_…");
//   var result = await client.Prequalify.RunAsync(input);
//
// The Configure(...) builder is the advanced surface (custom
// transport, clock, base URL, timeout).
using Isa.Sdk.Core;
using Isa.Sdk.Zyins.Cases;
using Isa.Sdk.Zyins.Options;
using Isa.Sdk.Zyins.Reference;

namespace Isa.Sdk.Zyins;

/// <summary>Strategy that mutates a <see cref="TransportRequest"/> to add auth headers.
/// Hides the bearer/license/session choice from the dispatcher and sub-clients.</summary>
internal interface IRequestSigner
{
    /// <summary>Return a new request with auth headers applied.</summary>
    TransportRequest Sign(TransportRequest request);
}

/// <summary>Adapts <see cref="Proxy.BearerTokenSigner"/> to <see cref="IRequestSigner"/>.</summary>
internal sealed class BearerTokenRequestSigner : IRequestSigner
{
    private readonly Proxy.BearerTokenSigner _signer;

    public BearerTokenRequestSigner(string token) => _signer = new Proxy.BearerTokenSigner(token);

    public TransportRequest Sign(TransportRequest request) => _signer.Sign(request);
}

/// <summary>Apply <c>Authorization: License &lt;base64(keycode:email)&gt;</c> + <c>X-Device-ID</c>
/// + <c>X-Device-Signature</c> headers. The device-signature primitive is implemented in the
/// shared Core transport-helpers package; this signer wires it into the request pipeline.</summary>
internal sealed class LicenseSigner : IRequestSigner
{
    private const string AuthorizationHeader = "Authorization";
    private const string DeviceIdHeader = "X-Device-ID";
    private const string DeviceSigHeader = "X-Device-Signature";
    private const string LicensePrefix = "License ";

    private readonly string _credential;
    private readonly string _deviceId;
    private readonly string _signingSecret;

    public LicenseSigner(string keycode, string email, string deviceId, string signingSecret)
    {
        if (string.IsNullOrWhiteSpace(keycode)) throw new ArgumentException("keycode must be non-empty", nameof(keycode));
        if (string.IsNullOrWhiteSpace(email)) throw new ArgumentException("email must be non-empty", nameof(email));
        if (string.IsNullOrWhiteSpace(deviceId)) throw new ArgumentException("deviceId must be non-empty", nameof(deviceId));
        if (signingSecret is null) throw new ArgumentNullException(nameof(signingSecret));
        _credential = Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes($"{keycode}:{email}"));
        _deviceId = deviceId;
        _signingSecret = signingSecret;
    }

    public TransportRequest Sign(TransportRequest request)
    {
        var headers = CompatHeaders.Copy(request.Headers);
        headers[AuthorizationHeader] = LicensePrefix + _credential;
        headers[DeviceIdHeader] = _deviceId;
        headers[DeviceSigHeader] = ComputeSignature(request);
        return request with { Headers = headers };
    }

    private string ComputeSignature(TransportRequest request)
    {
        // Canonical signing string per §4.5 of SDK_DESIGN.md: method + path + body.
        var canonical = $"{request.Method.ToString().ToUpperInvariant()}\n{request.Url.AbsolutePath}\n{request.Body ?? string.Empty}";
        var key = System.Text.Encoding.UTF8.GetBytes(_signingSecret);
        using var hmac = new System.Security.Cryptography.HMACSHA256(key);
        var sig = hmac.ComputeHash(System.Text.Encoding.UTF8.GetBytes(canonical));
        return CompatHex.ToLowerHex(sig);
    }
}

/// <summary>Apply the canonical four-header session-auth bundle
/// (<c>Authorization: Bearer …</c> + <c>X-Isa-Session-Id</c> +
/// <c>X-Isa-Timestamp</c> + <c>X-Isa-Signature</c>) to every outbound
/// request. The signing primitive lives in
/// <see cref="global::Isa.Sdk.Core.SignRequest"/>; this adapter just plumbs the
/// session credential through and lets the canonical helper compute the
/// bytes.</summary>
internal sealed class SessionRequestSigner : IRequestSigner
{
    private readonly string _sessionId;
    private readonly string _sessionSecret;
    private readonly IClock _clock;

    public SessionRequestSigner(string sessionId, string sessionSecret, IClock? clock = null)
    {
        if (string.IsNullOrWhiteSpace(sessionId)) throw new ArgumentException("sessionId must be non-empty", nameof(sessionId));
        if (string.IsNullOrEmpty(sessionSecret)) throw new ArgumentException("sessionSecret must be non-empty", nameof(sessionSecret));
        _sessionId = sessionId;
        _sessionSecret = sessionSecret;
        _clock = clock ?? SystemClock.Instance;
    }

    public TransportRequest Sign(TransportRequest request)
    {
        var headers = CompatHeaders.Copy(request.Headers);
        var signed = global::Isa.Sdk.Core.SignRequest.Sign(
            method: request.Method.ToString().ToUpperInvariant(),
            path: request.Url.PathAndQuery,
            body: request.Body ?? string.Empty,
            sessionId: _sessionId,
            sessionSecret: _sessionSecret,
            clock: _clock);
        foreach (var kv in signed.AsDictionary())
        {
            headers[kv.Key] = kv.Value;
        }
        return request with { Headers = headers };
    }
}

/// <summary>Construction options for <see cref="ZyInsClient"/>.</summary>
public sealed record ZyInsClientOptions
{
    /// <summary>API token (required for the bearer-mode constructor; ignored when a
    /// <see cref="IRequestSigner"/> is supplied internally for License/Session modes).
    /// Typically begins with <c>isa_live_</c> or <c>isa_test_</c>.</summary>
    public string Token { get; init; } = string.Empty;

    /// <summary>Base URL override; defaults to <see cref="ZyInsClient.DefaultBaseUrl"/>.</summary>
    public string? BaseUrl { get; init; }

    /// <summary>Request timeout; defaults to 30 seconds.</summary>
    public TimeSpan? Timeout { get; init; }

    /// <summary>Transport override; defaults to a fresh <see cref="HttpClientTransport"/>.</summary>
    public ITransport? Transport { get; init; }

    /// <summary>Clock override; defaults to <see cref="SystemClock.Instance"/>.</summary>
    public IClock? Clock { get; init; }

    /// <summary>Debug logger override; defaults to <see cref="DebugLogger.Default"/>
    /// which reads <c>ISA_LOG</c> at call time and writes to stderr.</summary>
    public DebugLogger? Logger { get; init; }

    /// <summary>Pluggable case-storage adapter — backs
    /// <c>Cases.SaveAsync</c> / <c>Cases.RecallAsync</c>. Defaults to
    /// <see cref="global::Isa.Sdk.Zyins.Cases.ZeroKnowledgeCaseStorage.Default"/>
    /// (an unwired singleton that throws on use until the consumer
    /// supplies a transport). Pass a configured storage adapter to opt
    /// into the locked default zero-knowledge persistence path, or any
    /// custom <see cref="ICaseStorage"/> for server-side adapters.</summary>
    public ICaseStorage? CaseStorage { get; init; }

    /// <summary>
    /// Per-surface API version override map. When null (default) each surface
    /// resolves via <see cref="BundledApiVersions.Map"/>. Mirrors the TS SDK's
    /// <c>IsaCreateOptions.apiVersion</c> field. Lookup per-call is
    /// <c>ApiVersion?[surface] ?? BundledApiVersions.Map[surface]</c>; the
    /// override map MUST NOT carry a <c>default</c> key (locked by PR #360).
    /// </summary>
    public IReadOnlyDictionary<string, IsaApiVersion>? ApiVersion { get; init; }
}

/// <summary>The ZyINS Tier 3 client. Construct once per token; methods
/// are grouped under typed sub-clients.</summary>
public sealed partial class ZyInsClient
{
    /// <summary>Production ZyINS endpoint. Override only for staging / local.</summary>
    public const string DefaultBaseUrl = "https://zyins.isaapi.com";

    private readonly OperationContext _ctx;

    internal OperationContext Context => _ctx;

    /// <summary>Prequalification operations.</summary>
    public PrequalifySubClient Prequalify { get; }

    /// <summary>Quoting operations.</summary>
    public QuoteSubClient Quote { get; }

    /// <summary>Dataset listing and retrieval.</summary>
    public DatasetsSubClient Datasets { get; }

    /// <summary>Memoized product catalog fetched from the server once per client lifetime.</summary>
    public ProductsSubClient Products { get; }

    /// <summary>Reference data lookup.</summary>
    public ReferenceDataSubClient ReferenceData { get; }

    /// <summary>Usage / billing data.</summary>
    public UsageSubClient Usage { get; }

    /// <summary>BPP license-lifecycle operations (Activate, Check, Deactivate).
    /// Targets the proto-backed <c>/v1/licenses/*</c> surface. Per the
    /// locked SDK syntax (TS canon: <c>isa.zyins.license</c>). A device
    /// has exactly one license.</summary>
    public LicenseSubClient License { get; }

    /// <summary>Platform readiness probe (`/ready`).</summary>
    public HealthSubClient Health { get; }

    /// <summary>Whitelabel branding lookup (`GET /v1/branding`).</summary>
    public BrandingSubClient Branding { get; }

    /// <summary>Per-license preferences document (`GET` / `POST /v1/preferences`).</summary>
    public PreferencesSubClient Preferences { get; }

    /// <summary>Case create + share. Targets `POST /v1/case` and the
    /// `POST /v1/email/enqueue` case-share helper.</summary>
    public CasesSubClient Cases { get; }

    /// <summary>Transactional email enqueue (`POST /v1/email/enqueue`).</summary>
    public EmailSubClient Email { get; }

    /// <summary>Non-credentialed carrier-logo lookup (`/v1/logo/{carrier}`).</summary>
    public LogosSubClient Logos { get; }

    /// <summary>v3 prequalify (<c>POST /v3/prequalify</c>) with the uniform
    /// pricing[] table. Idempotency keys auto-mint as UUID v4.</summary>
    public PrequalifyV3SubClient PrequalifyV3 { get; }

    /// <summary>v3 quote (<c>POST /v3/quote</c>) with the uniform pricing[]
    /// table, grouped by requested face amount.</summary>
    public QuoteV3SubClient QuoteV3 { get; }

    /// <summary>v3 reference catalog GET (<c>GET /v3/datasets</c>). Supports
    /// <c>include</c>, <c>fields=meta</c>, and conditional revalidation via
    /// <c>If-None-Match</c>.</summary>
    public DatasetsV3SubClient DatasetsV3 { get; }

    /// <summary>The typed reference namespace
    /// (<c>isa.Zyins.Reference.Medications.Match(text, bundle)</c> /
    /// <c>isa.Zyins.Reference.Conditions.Match(text, bundle)</c> /
    /// <c>isa.Zyins.Reference.Concepts.Match(text, bundle)</c>). Mirrors
    /// `isa.zyins.reference` in the canonical TS SDK. The matcher caches
    /// an internal index per <see cref="DatasetBundleV3"/> instance.
    /// </summary>
    public IReferenceFacade Reference { get; } = ReferenceFacade.Instance;

    /// <summary>Top-level cache-backed medication matcher. Exposes the
    /// bundleless <c>MatchAsync(text)</c> entry point per the locked
    /// SDK syntax. The catalog is fetched lazily on first call and
    /// memoized on this namespace instance; concurrent first-callers
    /// share one round-trip via <see cref="System.Threading.SemaphoreSlim"/>.
    /// The bundle-required <see cref="IConceptMatcher.Match(string, DatasetBundleV3)"/>
    /// entry point is preserved.</summary>
    public MedicationsNamespace Medications { get; }

    /// <summary>Top-level cache-backed condition matcher. Symmetric to
    /// <see cref="Medications"/>.</summary>
    public ConditionsNamespace Conditions { get; }

    /// <summary>Top-level cache-backed concept matcher across both
    /// axes (conditions tried first, then medications). Symmetric to
    /// <see cref="Medications"/>.</summary>
    public ConceptsNamespace Concepts { get; }

    /// <summary>Shared credential state for license-mode clients. Null when
    /// the client was constructed in bearer or session mode.</summary>
    internal IsaCredentialState? CredentialState { get; }

    /// <summary>
    /// Resolved per-surface API version map for this client. Caller overrides
    /// from <see cref="ZyInsClientOptions.ApiVersion"/> shadow the bundled
    /// defaults from <see cref="BundledApiVersions.Map"/>. Surfaces not in
    /// either source resolve to the bundled default at lookup time and throw
    /// on unknown surface ids (caller bug).
    /// </summary>
    public IReadOnlyDictionary<string, IsaApiVersion> ApiVersion { get; }

    /// <summary>
    /// Resolve the pinned major version for a single surface
    /// (<c>prequalify</c>, <c>quote</c>, ...). Caller overrides win; bundled
    /// defaults fall through. Throws <see cref="ArgumentException"/> when the
    /// surface id is not present in either map.
    /// </summary>
    public IsaApiVersion ResolveApiVersion(string surface)
    {
        if (string.IsNullOrWhiteSpace(surface))
        {
            throw new ArgumentException("ZyInsClient.ResolveApiVersion: surface must be non-empty", nameof(surface));
        }
        if (ApiVersion.TryGetValue(surface, out var overridden))
        {
            return overridden;
        }
        if (BundledApiVersions.Map.TryGetValue(surface, out var bundled))
        {
            return bundled;
        }
        throw new ArgumentException(
            $"ZyInsClient.ResolveApiVersion: unknown surface '{surface}' — not present in BundledApiVersions.Map",
            nameof(surface));
    }

    /// <summary>One-line construction: <c>new ZyInsClient(token)</c>.</summary>
    public ZyInsClient(string token, string? baseUrl = null, TimeSpan? timeout = null)
        : this(new ZyInsClientOptions { Token = token, BaseUrl = baseUrl, Timeout = timeout })
    {
    }

    /// <summary>Advanced construction with the full options record.</summary>
    public ZyInsClient(ZyInsClientOptions options)
    {
        if (options is null) throw new ArgumentNullException(nameof(options));
        if (string.IsNullOrWhiteSpace(options.Token))
            throw new ArgumentException("Token must be non-empty", nameof(options));

        var transport = options.Transport ?? HttpClientTransport.Default(options.Timeout);
        var clock = options.Clock ?? SystemClock.Instance;
        var baseUrl = options.BaseUrl ?? DefaultBaseUrl;
        IRequestSigner signer = new BearerTokenRequestSigner(options.Token);

        _ctx = new OperationContext(new Uri(baseUrl), signer, transport, clock, options.Logger ?? DebugLogger.Default);
        ApiVersion = ResolveApiVersionMap(options.ApiVersion);

        Prequalify = new PrequalifySubClient(_ctx);
        Quote = new QuoteSubClient(_ctx);
        Datasets = new DatasetsSubClient(_ctx);
        Products = new ProductsSubClient(_ctx);
        ReferenceData = new ReferenceDataSubClient(_ctx);
        Usage = new UsageSubClient(_ctx);
        License = new LicenseSubClient(_ctx);
        Health = new HealthSubClient(_ctx);
        Branding = new BrandingSubClient(_ctx);
        Preferences = new PreferencesSubClient(_ctx);
        Email = new EmailSubClient(_ctx);
        Logos = new LogosSubClient(_ctx);
        PrequalifyV3 = new PrequalifyV3SubClient(_ctx);
        QuoteV3 = new QuoteV3SubClient(_ctx);
        DatasetsV3 = new DatasetsV3SubClient(_ctx);
        // Cache-backed reference namespaces share a single bundle
        // resolver — fetching the catalog once per client serves all
        // three matchers.
        _sharedBundleCache = new BundleCache(new DatasetsV3BundleResolver(DatasetsV3)); var bundleCache = _sharedBundleCache;
        Medications = new MedicationsNamespace(bundleCache, ReferenceFacade.Instance.Medications);
        Conditions = new ConditionsNamespace(bundleCache, ReferenceFacade.Instance.Conditions);
        Concepts = new ConceptsNamespace(bundleCache, ReferenceFacade.Instance.Concepts);
        var caseStorage = options.CaseStorage ?? ZeroKnowledgeCaseStorage.Default;
        Cases = new CasesSubClient(_ctx, Email, caseStorage);
    }

    /// <summary>Internal constructor that accepts a pre-built signer (used by the License/Session factories).</summary>
    internal ZyInsClient(ZyInsClientOptions options, IRequestSigner signer)
        : this(options, signer, state: null) { }

    /// <summary>Internal constructor accepting a signer plus an optional credential
    /// state. License-mode factories pass the shared state so the
    /// <see cref="LicenseSubClient"/> can auto-stash the license key on
    /// successful activation.</summary>
    internal ZyInsClient(ZyInsClientOptions options, IRequestSigner signer, IsaCredentialState? state)
    {
        if (options is null) throw new ArgumentNullException(nameof(options));
        if (signer is null) throw new ArgumentNullException(nameof(signer));
        var transport = options.Transport ?? HttpClientTransport.Default(options.Timeout);
        var clock = options.Clock ?? SystemClock.Instance;
        var baseUrl = options.BaseUrl ?? DefaultBaseUrl;

        _ctx = new OperationContext(new Uri(baseUrl), signer, transport, clock, options.Logger ?? DebugLogger.Default);
        CredentialState = state;
        ApiVersion = ResolveApiVersionMap(options.ApiVersion);

        Prequalify = new PrequalifySubClient(_ctx);
        Quote = new QuoteSubClient(_ctx);
        Datasets = new DatasetsSubClient(_ctx);
        Products = new ProductsSubClient(_ctx);
        ReferenceData = new ReferenceDataSubClient(_ctx);
        Usage = new UsageSubClient(_ctx);
        License = new LicenseSubClient(_ctx, state);
        Health = new HealthSubClient(_ctx);
        Branding = new BrandingSubClient(_ctx);
        Preferences = new PreferencesSubClient(_ctx);
        Email = new EmailSubClient(_ctx);
        Logos = new LogosSubClient(_ctx);
        PrequalifyV3 = new PrequalifyV3SubClient(_ctx);
        QuoteV3 = new QuoteV3SubClient(_ctx);
        DatasetsV3 = new DatasetsV3SubClient(_ctx);
        // Cache-backed reference namespaces share a single bundle
        // resolver — fetching the catalog once per client serves all
        // three matchers.
        _sharedBundleCache = new BundleCache(new DatasetsV3BundleResolver(DatasetsV3)); var bundleCache = _sharedBundleCache;
        Medications = new MedicationsNamespace(bundleCache, ReferenceFacade.Instance.Medications);
        Conditions = new ConditionsNamespace(bundleCache, ReferenceFacade.Instance.Conditions);
        Concepts = new ConceptsNamespace(bundleCache, ReferenceFacade.Instance.Concepts);
        var caseStorage = options.CaseStorage ?? ZeroKnowledgeCaseStorage.Default;
        Cases = new CasesSubClient(_ctx, Email, caseStorage);
    }

    /// <summary>Begin a fluent builder for the advanced configuration path.</summary>
    public static ZyInsClientBuilder Configure(string token) => new(token);

    // ── v3 facade routing ────────────────────────────────────────────────
    // Mirrors the TS SDK's `ZyInsNamespace.prequalifyV3` / `quoteV3` callables
    // and the `apiVersion.prequalify === 'v3'` selector on
    // `ZyInsNamespace.prequalify`. The C# SDK exposes the v3 sub-clients
    // directly on the client (`PrequalifyV3` / `QuoteV3`); the namespace-level
    // shortcut + version assertion gives consumers the same pinned-routing
    // ergonomics without forcing them to thread the api version map through
    // every call site.

    private const string PrequalifySurface = "prequalify";
    private const string QuoteSurface = "quote";

    /// <summary>
    /// Run a v3 prequalify decision (<c>POST /v3/prequalify</c>) — namespace
    /// shortcut that asserts <c>ApiVersion[&quot;prequalify&quot;] ==
    /// IsaApiVersion.V3</c> before delegating to <see cref="PrequalifyV3"/>.
    /// Throws <see cref="IsaConfigException"/> when the pinned version is
    /// anything else; consumers opt in via
    /// <c>new ZyInsClientOptions { ApiVersion = { [&quot;prequalify&quot;] =
    /// IsaApiVersion.V3 } }</c>.
    /// </summary>
    public Task<PrequalifyV3Result> PrequalifyV3Async(PrequalifyV3Request input, CancellationToken ct = default)
    {
        AssertSurfaceVersion(PrequalifySurface, IsaApiVersion.V3, nameof(PrequalifyV3Async));
        return PrequalifyV3.RunAsync(input, ct);
    }

    /// <summary>
    /// Run a v3 quote (<c>POST /v3/quote</c>) — namespace shortcut that
    /// asserts <c>ApiVersion[&quot;quote&quot;] == IsaApiVersion.V3</c>
    /// before delegating to <see cref="QuoteV3"/>.
    /// </summary>
    public Task<QuoteV3Result> QuoteV3Async(QuoteV3Request input, CancellationToken ct = default)
    {
        AssertSurfaceVersion(QuoteSurface, IsaApiVersion.V3, nameof(QuoteV3Async));
        return QuoteV3.RunAsync(input, ct);
    }

    /// <summary>
    /// Polymorphic prequalify selector that routes to the v3 sub-client when
    /// <c>ApiVersion[&quot;prequalify&quot;] == IsaApiVersion.V3</c>. Mirrors
    /// the TS SDK's <c>isa.zyins.prequalify</c> callable: pin v3 once at
    /// construction time and call <see cref="PrequalifyAsync(PrequalifyV3Request, CancellationToken)"/>
    /// without thinking about versions per call site. The v3 wire shape is
    /// distinct from v1/v2 — typed return is <see cref="PrequalifyV3Result"/>.
    /// </summary>
    /// <exception cref="IsaConfigException">When the pinned prequalify
    /// version is not v3; use <see cref="Prequalify"/> for v1.</exception>
    public Task<PrequalifyV3Result> PrequalifyAsync(PrequalifyV3Request input, CancellationToken ct = default)
        => PrequalifyV3Async(input, ct);

    /// <summary>
    /// Polymorphic quote selector that routes to the v3 sub-client when
    /// <c>ApiVersion[&quot;quote&quot;] == IsaApiVersion.V3</c>. v1 callers
    /// continue to use <see cref="Quote"/>; v2 quote does not exist on the
    /// C# surface (no namespace alias).
    /// </summary>
    /// <exception cref="IsaConfigException">When the pinned quote version
    /// is not v3.</exception>
    public Task<QuoteV3Result> QuoteAsync(QuoteV3Request input, CancellationToken ct = default)
        => QuoteV3Async(input, ct);

    private void AssertSurfaceVersion(string surface, IsaApiVersion expected, string methodName)
    {
        var actual = ResolveApiVersion(surface);
        if (actual == expected) return;
        throw new IsaConfigException(
            $"ZyInsClient.{methodName} requires apiVersion '{expected}' on the {surface} surface, but this client is pinned to '{actual}'");
    }

    private static IReadOnlyDictionary<string, IsaApiVersion> ResolveApiVersionMap(
        IReadOnlyDictionary<string, IsaApiVersion>? overrides)
    {
        if (overrides is null) return new Dictionary<string, IsaApiVersion>();
        // Reject the locked-out "default" key at the boundary so wire-shape
        // surprises surface synchronously at construction (api-standards
        // §2.7) rather than downstream at first request.
        if (overrides.ContainsKey("default"))
        {
            throw new ArgumentException(
                "ZyInsClientOptions.ApiVersion: 'default' is not a valid key (locked by PR #360 §2.7)",
                nameof(overrides));
        }
        return overrides;
    }
}

/// <summary>Fluent builder for the advanced configuration path.</summary>
public sealed class ZyInsClientBuilder
{
    private readonly ZyInsClientOptions _options;

    internal ZyInsClientBuilder(string token)
    {
        _options = new ZyInsClientOptions { Token = token };
    }

    /// <summary>Override the base URL (default: production).</summary>
    public ZyInsClientBuilder WithBaseUrl(string baseUrl) =>
        new(_options with { BaseUrl = baseUrl });

    /// <summary>Override the request timeout (default: 30 seconds).</summary>
    public ZyInsClientBuilder WithTimeout(TimeSpan timeout) =>
        new(_options with { Timeout = timeout });

    /// <summary>Override the transport (default: <see cref="HttpClientTransport"/>).</summary>
    public ZyInsClientBuilder WithTransport(ITransport transport) =>
        new(_options with { Transport = transport });

    /// <summary>Override the clock (default: <see cref="SystemClock"/>).</summary>
    public ZyInsClientBuilder WithClock(IClock clock) =>
        new(_options with { Clock = clock });

    /// <summary>Override the per-surface API version map (default: bundled
    /// versions per <see cref="BundledApiVersions.Map"/>).</summary>
    public ZyInsClientBuilder WithApiVersion(IReadOnlyDictionary<string, IsaApiVersion> apiVersion) =>
        new(_options with { ApiVersion = apiVersion });

    private ZyInsClientBuilder(ZyInsClientOptions options) => _options = options;

    /// <summary>Build the client.</summary>
    public ZyInsClient Build() => new(_options);
}

/// <summary>Internal shared context every sub-client needs.</summary>
internal sealed record OperationContext(
    Uri BaseUrl,
    IRequestSigner Signer,
    ITransport Transport,
    IClock Clock,
    DebugLogger Logger);
