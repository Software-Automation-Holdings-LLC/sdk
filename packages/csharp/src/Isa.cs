// Top-level Sah.Sdk.Isa facade. Single entry point across all products
// (zyins, rapidsign, proxy, webhooks). Mirrors `isa.zyins.*`,
// `isa.rapidsign.*`, `isa.proxy.*`, `isa.webhooks.*` in the TS/Python/Go
// SDKs per SDK_DESIGN.md §0 (consolidation v0.3.0).
//
// Hello-world:
//
//     var isa = Isa.WithBearer();                       // reads ISA_TOKEN
//     var result = await isa.Zyins.Prequalify.RunAsync(req);
//
// Missing env vars produce IsaConfigException synchronously; the
// client never silently misbehaves with empty credentials.
using System;
using System.Threading.Tasks;
using Sah.Sdk.Core;
using Sah.Sdk.Zyins;

namespace Sah.Sdk;

/// <summary>License credentials, mirrored at the top level for ergonomic use
/// (<c>using Sah.Sdk;</c> brings <see cref="LicenseOptions"/> into scope).</summary>
public sealed record LicenseOptions
{
    /// <summary>Agent license keycode (e.g. <c>ABC-123-XYZ</c>).</summary>
    public required string Keycode { get; init; }

    /// <summary>Agent login email; lookup key on the server.</summary>
    public required string Email { get; init; }

    /// <summary>Optional device identifier; the SDK mints one when null.</summary>
    public string? DeviceId { get; init; }

    /// <summary>Optional HMAC signing secret from the license-exchange handshake.</summary>
    public string? SigningSecret { get; init; }
}

/// <summary>Session credentials for embedded browser flows.</summary>
public sealed record SessionOptions
{
    /// <summary>Session id minted by the session-mint endpoint.</summary>
    public required string SessionId { get; init; }

    /// <summary>HMAC signing secret returned alongside the session id.</summary>
    public required string SessionSecret { get; init; }
}

/// <summary>
/// Unified ISA SDK client. Holds product-specific sub-namespaces
/// (<see cref="Zyins"/>, <see cref="RapidSign"/>, <see cref="Proxy"/>,
/// <see cref="Webhooks"/>) sharing one transport, one auth strategy,
/// and one set of options.
/// </summary>
/// <example>
/// <code>
/// var isa = Isa.WithBearer();
/// var quote = await isa.Zyins.Prequalify.RunAsync(req);
/// </code>
/// </example>
public sealed class Isa
{
    /// <summary>ZyINS underwriting and prequalification surface.</summary>
    public ZyInsClient Zyins { get; }

    /// <summary>RapidSign document-workflow surface. Stub until v0.3.x product wiring.</summary>
    public Sah.Sdk.RapidSign.RapidSignNamespace RapidSign { get; }

    /// <summary>Proxy / transport-signing helpers.</summary>
    public Sah.Sdk.Proxy.ProxyNamespace Proxy { get; }

    /// <summary>Webhook verification helpers (HMAC, timestamp tolerance).</summary>
    public Sah.Sdk.Webhooks.WebhooksNamespace Webhooks { get; }

    private Isa(ZyInsClient zyins)
    {
        Zyins = zyins;
        RapidSign = new Sah.Sdk.RapidSign.RapidSignNamespace();
        Proxy = new Sah.Sdk.Proxy.ProxyNamespace();
        Webhooks = new Sah.Sdk.Webhooks.WebhooksNamespace();
    }

    /// <summary>
    /// Bearer-token client. Reads <c>ISA_TOKEN</c> from the environment when
    /// <paramref name="token"/> is null/empty.
    /// </summary>
    /// <exception cref="IsaConfigException">When no token is supplied AND env is unset.</exception>
    /// <example>
    /// <code>
    /// var isa = Isa.WithBearer();              // env-driven
    /// var isa = Isa.WithBearer("isa_live_…");  // explicit
    /// </code>
    /// </example>
    public static Isa WithBearer(string? token = null)
        => new(ZyinsFactory.WithBearer(token, options: null, env: SystemEnvironment.Instance));

    /// <summary>Test seam: same as <see cref="WithBearer(string)"/> but with an injectable environment.</summary>
    public static Isa WithBearer(string? token, IEnvironment env)
        => new(ZyinsFactory.WithBearer(token, options: null, env: env));

    /// <summary>
    /// License-bound client. Reads <c>ISA_LICENSE_KEYCODE</c> +
    /// <c>ISA_LICENSE_EMAIL</c> from the environment when <paramref name="options"/> is null.
    /// </summary>
    /// <exception cref="IsaConfigException">When keycode or email is missing.</exception>
    /// <example>
    /// <code>
    /// var isa = await Isa.WithLicenseAsync(new LicenseOptions
    /// {
    ///     Keycode = "ABC-123-XYZ",
    ///     Email   = "agent@example.com",
    /// });
    /// </code>
    /// </example>
    public static Task<Isa> WithLicenseAsync(LicenseOptions? options = null)
        => WithLicenseAsync(options, SystemEnvironment.Instance);

    /// <summary>Test seam: env-injectable variant.</summary>
    public static Task<Isa> WithLicenseAsync(LicenseOptions? options, IEnvironment env)
    {
        try
        {
            var creds = options is null ? null : new LicenseCredentials
            {
                Keycode = options.Keycode,
                Email = options.Email,
                DeviceId = options.DeviceId,
                SigningSecret = options.SigningSecret,
            };
            var client = ZyinsFactory.WithLicense(creds, options: null, env: env);
            return Task.FromResult(new Isa(client));
        }
        catch (Exception ex)
        {
            return Task.FromException<Isa>(ex);
        }
    }

    /// <summary>
    /// Session-bound client. Reads <c>ISA_SESSION_ID</c> + <c>ISA_SESSION_SECRET</c>
    /// from the environment when <paramref name="options"/> is null.
    /// </summary>
    /// <exception cref="IsaConfigException">When sessionId or sessionSecret is missing.</exception>
    /// <example>
    /// <code>
    /// var isa = Isa.WithSession();             // env-driven
    /// </code>
    /// </example>
    public static Isa WithSession(SessionOptions? options = null)
        => WithSession(options, SystemEnvironment.Instance);

    /// <summary>Test seam: env-injectable variant.</summary>
    public static Isa WithSession(SessionOptions? options, IEnvironment env)
    {
        var creds = options is null ? null : new SessionCredentials
        {
            SessionId = options.SessionId,
            SessionSecret = options.SessionSecret,
        };
        return new Isa(ZyinsFactory.WithSession(creds, options: null, env: env));
    }
}
