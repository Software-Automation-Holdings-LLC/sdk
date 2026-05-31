// Top-level `Isa` static facade. Mirrors `Isa.withBearer()` /
// `Isa.withLicense()` / `Isa.withSession()` across every language
// binding (SDK_DESIGN.md §3.2 / §3.3). The factories read sensible
// defaults from environment variables so the hello-world is two lines:
//
//     var isa = Isa.WithBearer();                       // reads ISA_TOKEN
//     var result = await isa.Prequalify.RunAsync(...);
//
// Missing env vars produce IsaConfigException synchronously; the
// client never silently misbehaves with empty credentials.
using Isa.Sdk.Core;

namespace Isa.Sdk.Zyins;

/// <summary>Source of environment variables. Defaults to the OS;
/// tests substitute an in-memory implementation.</summary>
public interface IEnvironment
{
    /// <summary>Return the variable's value, or null when unset / empty.</summary>
    string? Get(string name);
}

/// <summary>Backed by <see cref="Environment.GetEnvironmentVariable(string)"/>.</summary>
public sealed class SystemEnvironment : IEnvironment
{
    /// <summary>Shared singleton.</summary>
    public static readonly SystemEnvironment Instance = new();

    /// <inheritdoc />
    public string? Get(string name)
    {
        var v = Environment.GetEnvironmentVariable(name);
        return string.IsNullOrWhiteSpace(v) ? null : v;
    }
}

/// <summary>Per-factory option records. License and Session take more
/// than one credential, so they have dedicated input types.</summary>
internal sealed record LicenseCredentials
{
    /// <summary>Agent's license keycode (e.g. <c>ABC-123-XYZ</c>).</summary>
    public required string Keycode { get; init; }

    /// <summary>Agent's login email (used as the lookup key on the server).</summary>
    public required string Email { get; init; }

    /// <summary>Device identifier; on first run, callers may leave this null and the SDK
    /// will mint a fresh GUID. Persistence to disk is the caller's responsibility.</summary>
    public string? DeviceId { get; init; }

    /// <summary>HMAC signing secret derived from the license issuance handshake.</summary>
    public string? SigningSecret { get; init; }
}

/// <summary>Session credentials for browser-embedded forms.</summary>
internal sealed record SessionCredentials
{
    /// <summary>Session id.</summary>
    public required string SessionId { get; init; }

    /// <summary>HMAC signing secret returned by the session-mint endpoint.</summary>
    public required string SessionSecret { get; init; }
}

/// <summary>Top-level factory. Hides the strategy choice (bearer / license / session)
/// behind three named static methods. Each method reads sensible defaults from the
/// environment when called with no arguments.</summary>
internal static class ZyinsFactory
{
    private const string TokenEnvVar = "ISA_TOKEN";
    private const string LicenseKeycodeEnvVar = "ISA_LICENSE_KEYCODE";
    private const string LicenseEmailEnvVar = "ISA_LICENSE_EMAIL";
    private const string LicenseDeviceIdEnvVar = "ISA_DEVICE_ID";
    private const string LicenseSigningSecretEnvVar = "ISA_LICENSE_SIGNING_SECRET";
    private const string SessionIdEnvVar = "ISA_SESSION_ID";
    private const string SessionSecretEnvVar = "ISA_SESSION_SECRET";

    /// <summary>
    /// Construct a client authenticated with a long-lived bearer token.
    /// When <paramref name="token"/> is null/empty, reads <c>ISA_TOKEN</c> from
    /// the environment.
    /// </summary>
    /// <param name="token">Optional bearer token. When null/empty, env is consulted.</param>
    /// <param name="options">Optional client options (base URL, timeout, transport).</param>
    /// <returns>A fully constructed <see cref="ZyInsClient"/> in bearer mode.</returns>
    /// <exception cref="IsaConfigException">
    /// Thrown when no token is supplied AND <c>ISA_TOKEN</c> is unset.
    /// </exception>
    /// <example>
    /// <code>
    /// // Reads ISA_TOKEN from the environment:
    /// var isa = Isa.WithBearer();
    /// </code>
    /// </example>
    /// <seealso href="https://docs.isaapi.com/sdk/factories"/>
    public static ZyInsClient WithBearer(string? token = null, ZyInsClientOptions? options = null)
        => WithBearer(token, options, SystemEnvironment.Instance);

    /// <summary>Test seam: same as <see cref="WithBearer(string,ZyInsClientOptions)"/> but with
    /// an injectable environment so tests don't have to mutate process state.</summary>
    public static ZyInsClient WithBearer(string? token, ZyInsClientOptions? options, IEnvironment env)
    {
        if (env is null) throw new ArgumentNullException(nameof(env));
        var resolved = string.IsNullOrWhiteSpace(token) ? env.Get(TokenEnvVar) : token;
        if (string.IsNullOrWhiteSpace(resolved))
        {
            throw new IsaConfigException(
                $"Isa.WithBearer requires a token: pass one explicitly or set {TokenEnvVar}.");
        }

        var opts = options ?? new ZyInsClientOptions();
        // resolved is non-null here — the IsNullOrWhiteSpace guard above
        // narrows it, but the netstandard2.0 BCL omits the
        // [NotNullWhen(false)] annotation, so we bang for parity.
        return new ZyInsClient(opts with { Token = resolved! });
    }

    /// <summary>
    /// Construct a client authenticated with a license keycode + email pair.
    /// When <paramref name="credentials"/> is null, reads <c>ISA_LICENSE_KEYCODE</c> +
    /// <c>ISA_LICENSE_EMAIL</c> (and optional <c>ISA_DEVICE_ID</c>, <c>ISA_LICENSE_SIGNING_SECRET</c>)
    /// from the environment.
    /// </summary>
    /// <param name="credentials">Optional license credentials. When null, env is consulted.</param>
    /// <param name="options">Optional client options.</param>
    /// <returns>A fully constructed <see cref="ZyInsClient"/> in license mode.</returns>
    /// <exception cref="IsaConfigException">
    /// Thrown when keycode or email is missing from credentials and env.
    /// </exception>
    /// <example>
    /// <code>
    /// var isa = Isa.WithLicense(new LicenseCredentials
    /// {
    ///     Keycode = "ABC-123-XYZ",
    ///     Email   = "agent@example.com",
    /// });
    /// </code>
    /// </example>
    /// <seealso href="https://docs.isaapi.com/sdk/factories"/>
    public static ZyInsClient WithLicense(LicenseCredentials? credentials = null, ZyInsClientOptions? options = null)
        => WithLicense(credentials, options, SystemEnvironment.Instance, store: null);

    /// <summary>Test seam: same as <see cref="WithLicense(LicenseCredentials,ZyInsClientOptions)"/>
    /// but with an injectable environment.</summary>
    public static ZyInsClient WithLicense(LicenseCredentials? credentials, ZyInsClientOptions? options, IEnvironment env)
        => WithLicense(credentials, options, env, store: null);

    /// <summary>Build a license-mode client with an attached credential store.
    /// The store backs the shared <see cref="IsaCredentialState"/> so the
    /// <see cref="LicenseSubClient"/> can auto-stash the license key on
    /// successful activation.</summary>
    public static ZyInsClient WithLicense(LicenseCredentials? credentials, ZyInsClientOptions? options, IEnvironment env, ICredentialStore? store)
    {
        if (env is null) throw new ArgumentNullException(nameof(env));
        var keycode = credentials?.Keycode is { Length: > 0 } k ? k : env.Get(LicenseKeycodeEnvVar);
        var email = credentials?.Email is { Length: > 0 } e ? e : env.Get(LicenseEmailEnvVar);
        var deviceId = credentials?.DeviceId ?? env.Get(LicenseDeviceIdEnvVar);
        var signingSecret = credentials?.SigningSecret ?? env.Get(LicenseSigningSecretEnvVar);

        if (string.IsNullOrWhiteSpace(keycode) || string.IsNullOrWhiteSpace(email))
        {
            throw new IsaConfigException(
                $"Isa.WithLicense requires keycode + email: pass them explicitly or set {LicenseKeycodeEnvVar} and {LicenseEmailEnvVar}.");
        }

        // Device-id is minted for first-run callers if neither code nor env supplies one.
        var resolvedDeviceId = deviceId ?? Guid.NewGuid().ToString("N");
        // Signing secret falls back to the keycode until the full license-exchange roundtrip lands.
        var resolvedSecret = signingSecret ?? keycode;

        var opts = options ?? new ZyInsClientOptions();
        var resolvedStore = store ?? new InMemoryCredentialStore();
        var licenseKey = RestoreLicenseKey(resolvedStore);
        var state = new IsaCredentialState(
            email: email!,
            orderId: keycode!,
            deviceId: resolvedDeviceId,
            licenseKey: licenseKey,
            store: resolvedStore);
        var signer = new LicenseSigner(keycode!, email!, resolvedDeviceId, resolvedSecret!);
        return new ZyInsClient(opts, signer, state);
    }

    private static string RestoreLicenseKey(ICredentialStore store)
    {
        try
        {
            return store.GetAsync(CredentialKeys.LicenseKey).GetAwaiter().GetResult() ?? string.Empty;
        }
        catch (Exception ex)
        {
            throw new IsaConfigException("Isa.WithLicense failed to restore the stashed license key.", ex);
        }
    }

    /// <summary>
    /// Construct a client authenticated with a session id + secret pair.
    /// When <paramref name="credentials"/> is null, reads <c>ISA_SESSION_ID</c> +
    /// <c>ISA_SESSION_SECRET</c> from the environment.
    /// </summary>
    /// <param name="credentials">Optional session credentials. When null, env is consulted.</param>
    /// <param name="options">Optional client options.</param>
    /// <returns>A fully constructed <see cref="ZyInsClient"/> in session mode.</returns>
    /// <exception cref="IsaConfigException">
    /// Thrown when sessionId or sessionSecret is missing from credentials and env.
    /// </exception>
    /// <example>
    /// <code>
    /// // Reads ISA_SESSION_ID and ISA_SESSION_SECRET from the environment:
    /// var isa = Isa.WithSession();
    /// </code>
    /// </example>
    /// <seealso href="https://docs.isaapi.com/sdk/factories"/>
    public static ZyInsClient WithSession(SessionCredentials? credentials = null, ZyInsClientOptions? options = null)
        => WithSession(credentials, options, SystemEnvironment.Instance);

    /// <summary>Test seam: same as <see cref="WithSession(SessionCredentials,ZyInsClientOptions)"/>
    /// but with an injectable environment.</summary>
    public static ZyInsClient WithSession(SessionCredentials? credentials, ZyInsClientOptions? options, IEnvironment env)
    {
        if (env is null) throw new ArgumentNullException(nameof(env));
        var sessionId = credentials?.SessionId is { Length: > 0 } s ? s : env.Get(SessionIdEnvVar);
        var sessionSecret = credentials?.SessionSecret is { Length: > 0 } ss ? ss : env.Get(SessionSecretEnvVar);

        if (string.IsNullOrWhiteSpace(sessionId) || string.IsNullOrWhiteSpace(sessionSecret))
        {
            throw new IsaConfigException(
                $"Isa.WithSession requires sessionId + sessionSecret: pass them explicitly or set {SessionIdEnvVar} and {SessionSecretEnvVar}.");
        }

        var opts = options ?? new ZyInsClientOptions();
        // Non-null after the IsNullOrWhiteSpace guard above; see note in
        // WithLicense for the netstandard2.0 rationale.
        var signer = new SessionRequestSigner(sessionId!, sessionSecret!, opts.Clock);
        return new ZyInsClient(opts, signer);
    }
}
