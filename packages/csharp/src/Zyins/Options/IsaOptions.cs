// Typed options-bag constructor for Isa. Mirrors
// packages/ts/src/zyins/isaOptions.ts and the Python / Go / PHP SDKs.
//
// The historic factories (Isa.WithBearer, Isa.WithLicense, Isa.WithSession)
// remain the canonical primitives until the follow-up IsaOptions dispatch
// facade lands.

using System;
using System.Collections.Generic;
using Isa.Sdk.Zyins.Cases;

namespace Isa.Sdk.Zyins.Options;

/// <summary>
/// Pinned API major version per <see cref="global::Isa.Sdk.Isa"/> instance.
/// </summary>
public enum IsaApiVersion
{
    /// <summary>The legacy /v1/ contract.</summary>
    V1,
    /// <summary>The typed-offer /v2/ contract (default).</summary>
    V2,
    /// <summary>The /v3/ contract with the uniform pricing[] table.</summary>
    V3,
}

/// <summary>
/// Tagged auth-supplier discriminated value type accepted by
/// <see cref="IsaOptions"/>. Implementations: <see cref="BearerAuth"/>,
/// <see cref="LicenseAuth"/>, <see cref="FormAuth"/>,
/// <see cref="SessionAuth"/>. Each carries the credential material the
/// matching factory will require when the dispatch facade lands.
/// </summary>
public abstract record AuthSupplier
{
    /// <summary>Stable discriminator string for the supplier kind.</summary>
    public abstract string Kind { get; }
}

/// <summary>
/// Bearer-token auth supplier. A null Token defers resolution to the
/// legacy factory's env-var fallback at factory time (matches the TS
/// <c>BearerAuth.fromEnv()</c> shape).
/// </summary>
public sealed record BearerAuth : AuthSupplier
{
    private BearerAuth(string? token)
    {
        Token = token;
    }

    public override string Kind => "bearer";
    public string? Token { get; }

    /// <summary>Construct from an explicit token. Validates non-emptiness.</summary>
    public static BearerAuth FromToken(string token)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            throw new ArgumentException("BearerAuth.FromToken: token must be a non-empty string", nameof(token));
        }
        return new BearerAuth(token);
    }

    /// <summary>Construct a deferred-resolution supplier (reads ISA_TOKEN at factory time).</summary>
    public static BearerAuth FromEnv() => new BearerAuth(token: null);
}

/// <summary>
/// License-credential auth supplier. Null fields defer resolution to
/// the legacy factory's env-var fallback (ISA_LICENSE_KEYCODE /
/// ISA_LICENSE_EMAIL).
/// </summary>
public sealed record LicenseAuth : AuthSupplier
{
    private LicenseAuth(string? keycode, string? email)
    {
        Keycode = keycode;
        Email = email;
    }

    public override string Kind => "license";
    public string? Keycode { get; }
    public string? Email { get; }

    /// <summary>Construct from explicit keycode + email.</summary>
    public static LicenseAuth FromKeycode(string keycode, string email)
    {
        if (string.IsNullOrWhiteSpace(keycode))
        {
            throw new ArgumentException("LicenseAuth.FromKeycode: keycode must be a non-empty string", nameof(keycode));
        }
        if (string.IsNullOrWhiteSpace(email))
        {
            throw new ArgumentException("LicenseAuth.FromKeycode: email must be a non-empty string", nameof(email));
        }
        return new LicenseAuth(keycode, email);
    }

    /// <summary>Construct a deferred-resolution supplier (reads env vars at factory time).</summary>
    public static LicenseAuth FromEnv() => new LicenseAuth(keycode: null, email: null);
}

/// <summary>
/// Form-token auth supplier (embedded eApp).
/// </summary>
public sealed record FormAuth : AuthSupplier
{
    private FormAuth(string formToken)
    {
        FormToken = formToken;
    }

    public override string Kind => "form";
    public string FormToken { get; }

    public static FormAuth FromToken(string formToken)
    {
        if (string.IsNullOrWhiteSpace(formToken))
        {
            throw new ArgumentException("FormAuth.FromToken: formToken must be a non-empty string", nameof(formToken));
        }
        return new FormAuth(formToken);
    }
}

/// <summary>
/// Session-credential auth supplier. Null fields defer resolution to the
/// legacy factory's env-var fallback.
/// </summary>
public sealed record SessionAuth : AuthSupplier
{
    private SessionAuth(string? sessionId, string? sessionSecret)
    {
        SessionId = sessionId;
        SessionSecret = sessionSecret;
    }

    public override string Kind => "session";
    /// <summary>Session identifier, or null for deferred env resolution.</summary>
    public string? SessionId { get; }
    /// <summary>Session secret, or null for deferred env resolution.</summary>
    public string? SessionSecret { get; }

    /// <summary>Construct from explicit session credentials.</summary>
    public static SessionAuth FromCredentials(string sessionId, string sessionSecret)
    {
        if (string.IsNullOrWhiteSpace(sessionId))
        {
            throw new ArgumentException("SessionAuth.FromCredentials: sessionId must be a non-empty string", nameof(sessionId));
        }
        if (string.IsNullOrWhiteSpace(sessionSecret))
        {
            throw new ArgumentException("SessionAuth.FromCredentials: sessionSecret must be a non-empty string", nameof(sessionSecret));
        }
        return new SessionAuth(sessionId, sessionSecret);
    }

    /// <summary>Construct a deferred-resolution supplier (reads env vars at factory time).</summary>
    public static SessionAuth FromEnv() => new SessionAuth(sessionId: null, sessionSecret: null);
}

/// <summary>
/// Tagged engine-selector discriminated value type accepted by
/// <see cref="IsaOptions"/>. Implementations: <see cref="RemoteEngine"/>,
/// <see cref="LocalEngine"/>, <see cref="ProxyEngine"/>,
/// <see cref="InMemoryEngine"/>. Each maps to a base URL (and proxy
/// origin where applicable) consumed by <see cref="ResolvedIsaOptions.Resolve"/>.
/// </summary>
public abstract record Engine
{
    /// <summary>Stable discriminator string for the engine kind.</summary>
    public abstract string Kind { get; }

    /// <summary>Base URL the underlying ZyINS request targets.</summary>
    public abstract string BaseUrl { get; }
}

/// <summary>Production (or staging) ZyINS endpoint engine selector.</summary>
public sealed record RemoteEngine : Engine
{
    /// <summary>Production ZyINS endpoint origin.</summary>
    public const string ProductionOrigin = "https://zyins.isaapi.com";

    public override string Kind => "remote";
    public override string BaseUrl { get; }

    private RemoteEngine(string baseUrl)
    {
        BaseUrl = baseUrl;
    }

    /// <summary>Default — production endpoint.</summary>
    public static RemoteEngine Default { get; } = new RemoteEngine(ProductionOrigin);

    /// <summary>Construct from an explicit base URL (staging, region-specific).</summary>
    public static RemoteEngine At(string baseUrl)
    {
        if (string.IsNullOrWhiteSpace(baseUrl))
        {
            throw new ArgumentException("RemoteEngine.At: baseUrl must be a non-empty string", nameof(baseUrl));
        }
        return new RemoteEngine(baseUrl);
    }
}

/// <summary>Local engine — points at a developer or test endpoint.</summary>
public sealed record LocalEngine : Engine
{
    public override string Kind => "local";
    public override string BaseUrl { get; }

    private LocalEngine(string baseUrl)
    {
        BaseUrl = baseUrl;
    }

    public static LocalEngine At(string baseUrl)
    {
        if (string.IsNullOrWhiteSpace(baseUrl))
        {
            throw new ArgumentException("LocalEngine.At: baseUrl must be a non-empty string", nameof(baseUrl));
        }
        return new LocalEngine(baseUrl);
    }
}

/// <summary>Routes through the platform proxy.</summary>
public sealed record ProxyEngine : Engine
{
    /// <summary>Production proxy endpoint origin.</summary>
    public const string ProductionOrigin = "https://proxy.isaapi.com";

    public override string Kind => "proxy";
    /// <summary>Underlying ZyINS request targets the production origin; ProxyOrigin is consumed by the proxy namespace.</summary>
    public override string BaseUrl => RemoteEngine.ProductionOrigin;

    public string ProxyOrigin { get; }

    private ProxyEngine(string proxyOrigin)
    {
        ProxyOrigin = proxyOrigin;
    }

    public static ProxyEngine Default { get; } = new ProxyEngine(ProductionOrigin);

    public static ProxyEngine At(string proxyOrigin)
    {
        if (string.IsNullOrWhiteSpace(proxyOrigin))
        {
            throw new ArgumentException("ProxyEngine.At: proxyOrigin must be a non-empty string", nameof(proxyOrigin));
        }
        return new ProxyEngine(proxyOrigin);
    }
}

/// <summary>In-process mock engine — bypasses HTTP entirely. Test-only.</summary>
public sealed record InMemoryEngine : Engine
{
    private InMemoryEngine() { }

    public override string Kind => "in_memory";
    public override string BaseUrl => RemoteEngine.ProductionOrigin;

    public static InMemoryEngine Instance { get; } = new InMemoryEngine();
}

/// <summary>
/// Typed options bag that mirrors the upcoming <c>Isa.Create</c> surface.
///
/// Mirrors the TS <c>IsaCreateOptions</c> and Python
/// <c>IsaCreateOptions</c> shapes. Every field is optional except
/// <see cref="Auth"/>; defaults match the production posture
/// (RemoteEngine.Default, 30s timeout, per-surface versions from
/// <see cref="BundledApiVersions"/>).
/// </summary>
public sealed record IsaOptions
{
    /// <summary>Default per-call timeout (matches the TS 30_000 ms default).</summary>
    public static readonly TimeSpan DefaultTimeout = TimeSpan.FromSeconds(30);

    /// <summary>Auth supplier. Required.</summary>
    public required AuthSupplier Auth { get; init; }
    /// <summary>Engine selector. Default: <see cref="RemoteEngine.Default"/>.</summary>
    public Engine? Engine { get; init; }
    /// <summary>Per-call timeout. Default: <see cref="DefaultTimeout"/>.</summary>
    public TimeSpan? Timeout { get; init; }
    /// <summary>
    /// Per-surface API version override map. Resolution per call:
    /// <c>ApiVersion?[surface] ?? BundledApiVersions.Map[surface]</c>.
    /// No <c>default</c> key. No scalar shorthand. Locked by PR #360
    /// (see <c>docs/sdk-syntax-proposal.md §2.7</c>).
    /// </summary>
    public IReadOnlyDictionary<string, IsaApiVersion>? ApiVersion { get; init; }
    /// <summary>
    /// Pluggable case-storage adapter. Defaults to
    /// <see cref="ZeroKnowledgeCaseStorage"/> when null at resolve time
    /// — the locked default per PR #361 (zero-knowledge,
    /// fragment-key E2EE, no plaintext leaves the SDK).
    /// </summary>
    public ICaseStorage? CaseStorage { get; init; }
    /// <summary>Optional consumer build identifier.</summary>
    public string? ClientVersion { get; init; }

    /// <summary>
    /// Resolve the API version for a given surface. Lookup order:
    /// caller override → bundled default. Throws when the surface is
    /// not in the bundled map (unknown surface — caller bug).
    /// </summary>
    /// <param name="surface">Stable surface identifier (e.g. <c>prequalify</c>).</param>
    public IsaApiVersion ResolveApiVersion(string surface)
    {
        if (string.IsNullOrWhiteSpace(surface))
        {
            throw new ArgumentException("IsaOptions.ResolveApiVersion: surface must be non-empty", nameof(surface));
        }
        if (ApiVersion is not null && ApiVersion.TryGetValue(surface, out var overridden))
        {
            return overridden;
        }
        if (BundledApiVersions.Map.TryGetValue(surface, out var bundled))
        {
            return bundled;
        }
        throw new ArgumentException(
            $"IsaOptions.ResolveApiVersion: unknown surface '{surface}' — not present in BundledApiVersions.Map",
            nameof(surface));
    }
}

/// <summary>
/// Resolved view of <see cref="IsaOptions"/> with defaults applied.
///
/// Pure value object — produced by <see cref="Resolve"/>, safe to pass
/// between the future public options facade and the internal
/// <c>ZyInsClient</c> constructor.
/// </summary>
public sealed record ResolvedIsaOptions(
    AuthSupplier Auth,
    Engine Engine,
    TimeSpan Timeout,
    IReadOnlyDictionary<string, IsaApiVersion> ApiVersion,
    ICaseStorage CaseStorage,
    string? ClientVersion,
    string BaseUrl,
    string? ProxyOrigin)
{
    /// <summary>
    /// Resolve the API version for a given surface against the
    /// caller's overrides, falling back to <see cref="BundledApiVersions.Map"/>.
    /// </summary>
    public IsaApiVersion ResolveApiVersion(string surface)
    {
        if (string.IsNullOrWhiteSpace(surface))
        {
            throw new ArgumentException("ResolvedIsaOptions.ResolveApiVersion: surface must be non-empty", nameof(surface));
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
            $"ResolvedIsaOptions.ResolveApiVersion: unknown surface '{surface}' — not present in BundledApiVersions.Map",
            nameof(surface));
    }

    /// <summary>
    /// Resolve <see cref="IsaOptions"/> into a fully-defaulted view.
    /// Pure — no side effects, safe to call from constructors and tests.
    /// </summary>
    public static ResolvedIsaOptions Resolve(IsaOptions opts)
    {
        if (opts is null)
        {
            throw new ArgumentNullException(nameof(opts));
        }
        if (opts.Auth is null)
        {
            throw new ArgumentNullException(nameof(opts.Auth));
        }
        var engine = opts.Engine ?? RemoteEngine.Default;
        if (engine is InMemoryEngine)
        {
            throw new NotSupportedException("ResolvedIsaOptions.Resolve: InMemoryEngine is not wired in the C# SDK yet");
        }
        if (!string.IsNullOrEmpty(opts.ClientVersion))
        {
            throw new NotSupportedException("ResolvedIsaOptions.Resolve: ClientVersion is not wired in the C# SDK yet");
        }
        var proxyOrigin = engine is ProxyEngine pe ? pe.ProxyOrigin : null;
        var timeout = opts.Timeout.GetValueOrDefault();
        if (timeout == TimeSpan.Zero)
        {
            timeout = IsaOptions.DefaultTimeout;
        }
        var apiVersion = opts.ApiVersion ?? new Dictionary<string, IsaApiVersion>();
        var caseStorage = opts.CaseStorage ?? ZeroKnowledgeCaseStorage.Default;
        return new ResolvedIsaOptions(
            Auth: opts.Auth,
            Engine: engine,
            Timeout: timeout,
            ApiVersion: apiVersion,
            CaseStorage: caseStorage,
            ClientVersion: opts.ClientVersion,
            BaseUrl: engine.BaseUrl,
            ProxyOrigin: proxyOrigin
        );
    }
}
