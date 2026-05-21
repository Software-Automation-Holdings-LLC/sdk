// Top-level ZyINS client. One-line construction with a bearer token:
//
//   using Sah.Sdk.Zyins;
//   var client = new ZyInsClient("isa_live_…");
//   var result = await client.Prequalify.RunAsync(input);
//
// The Configure(...) builder is the advanced surface (custom
// transport, clock, base URL, timeout).
using Sah.Sdk.Core;

namespace Sah.Sdk.Zyins;

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
/// <see cref="Sah.Sdk.Core.SignRequest"/>; this adapter just plumbs the
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
        var signed = Sah.Sdk.Core.SignRequest.Sign(
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
}

/// <summary>The ZyINS Tier 3 client. Construct once per token; methods
/// are grouped under typed sub-clients.</summary>
public sealed class ZyInsClient
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

    /// <summary>Reference data lookup.</summary>
    public ReferenceDataSubClient ReferenceData { get; }

    /// <summary>Usage / billing data.</summary>
    public UsageSubClient Usage { get; }

    /// <summary>Public BPP license-lifecycle operations (Check, Deactivate).
    /// Targets the proto-backed `/v1/licenses/*` surface.</summary>
    public LicensesSubClient Licenses { get; }

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

    /// <summary>Shared credential state for license-mode clients. Null when
    /// the client was constructed in bearer or session mode.</summary>
    internal IsaCredentialState? CredentialState { get; }

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

        Prequalify = new PrequalifySubClient(_ctx);
        Quote = new QuoteSubClient(_ctx);
        Datasets = new DatasetsSubClient(_ctx);
        ReferenceData = new ReferenceDataSubClient(_ctx);
        Usage = new UsageSubClient(_ctx);
        Licenses = new LicensesSubClient(_ctx);
        Health = new HealthSubClient(_ctx);
        Branding = new BrandingSubClient(_ctx);
        Preferences = new PreferencesSubClient(_ctx);
        Email = new EmailSubClient(_ctx);
        Cases = new CasesSubClient(_ctx, Email);
        Logos = new LogosSubClient(_ctx);
    }

    /// <summary>Internal constructor that accepts a pre-built signer (used by the License/Session factories).</summary>
    internal ZyInsClient(ZyInsClientOptions options, IRequestSigner signer)
        : this(options, signer, state: null) { }

    /// <summary>Internal constructor accepting a signer plus an optional credential
    /// state. License-mode factories pass the shared state so the
    /// <see cref="LicensesSubClient"/> can auto-stash the license key on
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

        Prequalify = new PrequalifySubClient(_ctx);
        Quote = new QuoteSubClient(_ctx);
        Datasets = new DatasetsSubClient(_ctx);
        ReferenceData = new ReferenceDataSubClient(_ctx);
        Usage = new UsageSubClient(_ctx);
        Licenses = new LicensesSubClient(_ctx, state);
        Health = new HealthSubClient(_ctx);
        Branding = new BrandingSubClient(_ctx);
        Preferences = new PreferencesSubClient(_ctx);
        Email = new EmailSubClient(_ctx);
        Cases = new CasesSubClient(_ctx, Email);
        Logos = new LogosSubClient(_ctx);
    }

    /// <summary>Begin a fluent builder for the advanced configuration path.</summary>
    public static ZyInsClientBuilder Configure(string token) => new(token);
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
