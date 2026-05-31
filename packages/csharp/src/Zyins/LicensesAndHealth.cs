// Licenses + Health sub-clients.
//
// Licenses targets the public BPP license-lifecycle endpoints at
// `/v2/licenses/{activate,check,deactivate}`. These three operations sit
// OUTSIDE AuthMiddleware on the server: activate is the call that MINTS the
// licenseKey, so we cannot sign requests with a credential we do not yet
// have. Headers carry only Idempotency-Key and the device id; no HMAC
// signature, no Authorization header. Wire bodies use camelCase
// (deviceId, licenseKey).
//
// Health targets the shared platform readiness probe `/ready` defined
// in shared/schemas/api/isa/v1/health.proto. The probe is
// unauthenticated; an attached bearer header is harmless and lets one
// client serve every operation.
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Isa.Sdk.Zyins;

/// <summary>License validation state mirror of the proto `LicenseStatus`
/// enum. Wire values are lower-case strings.</summary>
public enum LicenseValidationStatus
{
    /// <summary>Default / unknown wire value.</summary>
    Unknown,
    /// <summary>License is authenticated and currently usable (wire: `valid`).</summary>
    Valid,
    /// <summary>Credentials do not match a known license (wire: `invalid`).</summary>
    Invalid,
    /// <summary>License exists but is not currently usable (wire: `inactive`).</summary>
    Inactive,
}

/// <summary>Probe outcome enum, mirror of proto `ServingStatus`.</summary>
public enum ServingStatus
{
    /// <summary>Default zero value; client could not parse the wire value.</summary>
    Unspecified,
    /// <summary>Component is healthy and accepting traffic (wire: `serving`).</summary>
    Serving,
    /// <summary>Component is unhealthy (wire: `not_serving`).</summary>
    NotServing,
    /// <summary>Component state could not be determined (wire: `unknown`).</summary>
    Unknown,
}

/// <summary>Typed request for <see cref="LicenseSubClient.CheckAsync(LicenseCheckRequest, CancellationToken)"/>.</summary>
public sealed record LicenseCheckRequest
{
    /// <summary>Email associated with the license. Required.</summary>
    public string Email { get; init; } = string.Empty;

    /// <summary>BPP order keycode (XXX-XXX-XXX). Required.</summary>
    public string Keycode { get; init; } = string.Empty;

    /// <summary>Optional client-generated device fingerprint.</summary>
    [JsonPropertyName("deviceId")]
    public string? DeviceId { get; init; }

    /// <summary>Optional license key to verify.</summary>
    [JsonPropertyName("licenseKey")]
    public string? LicenseKey { get; init; }
}

/// <summary>Typed response from <see cref="LicenseSubClient.CheckAsync(LicenseCheckRequest, CancellationToken)"/>.</summary>
public sealed record LicenseCheckResult
{
    /// <summary>Validation outcome as the raw wire value (`active`, `valid`, `invalid`, `inactive`).</summary>
    public string Status { get; init; } = string.Empty;

    /// <summary>Typed accessor for <see cref="Status"/>.</summary>
    [JsonIgnore]
    public LicenseValidationStatus ValidationStatus => Status switch
    {
        "active" => LicenseValidationStatus.Valid,
        "valid" => LicenseValidationStatus.Valid,
        "invalid" => LicenseValidationStatus.Invalid,
        "inactive" => LicenseValidationStatus.Inactive,
        _ => LicenseValidationStatus.Unknown,
    };
}

/// <summary>Typed request for <see cref="LicenseSubClient.DeactivateAsync(LicenseDeactivateRequest, CancellationToken)"/>.</summary>
public sealed record LicenseDeactivateRequest
{
    /// <summary>Email associated with the license. Required.</summary>
    public string Email { get; init; } = string.Empty;

    /// <summary>BPP order keycode. Required.</summary>
    public string Keycode { get; init; } = string.Empty;

    /// <summary>Optional device fingerprint; reset on success.</summary>
    [JsonPropertyName("deviceId")]
    public string? DeviceId { get; init; }
}

/// <summary>Typed response from <see cref="LicenseSubClient.DeactivateAsync(LicenseDeactivateRequest, CancellationToken)"/>.</summary>
public sealed record LicenseDeactivateResult
{
    /// <summary>Always <c>inactive</c> on success (legacy <c>deactivated</c> is also accepted).</summary>
    public string Status { get; init; } = string.Empty;

    /// <summary>Activations remaining on the order after this call. Zero when the server
    /// did not include the field (e.g. legacy v1 responses).</summary>
    [JsonPropertyName("remainingActivations")]
    public int RemainingActivations { get; init; }
}

/// <summary>Per-dependency readiness probe outcome.</summary>
public sealed record ProbeResult
{
    /// <summary>Raw wire value (`serving`, `not_serving`, `unknown`).</summary>
    public string Status { get; init; } = string.Empty;

    /// <summary>Observed round-trip latency in milliseconds.</summary>
    [JsonPropertyName("latency_ms")]
    public long LatencyMs { get; init; }

    /// <summary>Human-readable explanation when not serving; empty otherwise.</summary>
    public string Message { get; init; } = string.Empty;

    /// <summary>ISO 8601 timestamp at which this probe ran.</summary>
    [JsonPropertyName("checked_at")]
    public string CheckedAt { get; init; } = string.Empty;

    /// <summary>Typed accessor for <see cref="Status"/>.</summary>
    [JsonIgnore]
    public ServingStatus ServingStatus => Status switch
    {
        "serving" => ServingStatus.Serving,
        "not_serving" => ServingStatus.NotServing,
        "unknown" => ServingStatus.Unknown,
        _ => ServingStatus.Unspecified,
    };
}

/// <summary>Typed response from <see cref="HealthSubClient.GetReadinessAsync"/>.</summary>
public sealed record ReadinessResult
{
    /// <summary>True iff every required sub-probe returned `serving`.</summary>
    public bool Ready { get; init; }

    /// <summary>Overall serving status mirror of <see cref="Ready"/>.</summary>
    public string Status { get; init; } = string.Empty;

    /// <summary>Primary dependency probe (database for ZyINS).</summary>
    public ProbeResult Db { get; init; } = new();

    /// <summary>Secondary dependency probe (cache).</summary>
    public ProbeResult Cache { get; init; } = new();

    /// <summary>Additional downstream probes keyed by logical service name.</summary>
    [JsonPropertyName("downstream_services")]
    public IReadOnlyDictionary<string, ProbeResult> DownstreamServices { get; init; }
        = new Dictionary<string, ProbeResult>();

    /// <summary>ISO 8601 timestamp at which this readiness evaluation ran.</summary>
    [JsonPropertyName("checked_at")]
    public string CheckedAt { get; init; } = string.Empty;
}

/// <summary>Typed request for <see cref="LicenseSubClient.ActivateAsync(LicenseActivateRequest, CancellationToken)"/>.</summary>
public sealed record LicenseActivateRequest
{
    /// <summary>Email associated with the license. Required.</summary>
    public string Email { get; init; } = string.Empty;

    /// <summary>BPP order keycode in XXX-XXX-XXX format. Required.</summary>
    public string Keycode { get; init; } = string.Empty;

    /// <summary>Client-generated device fingerprint. Required.</summary>
    [JsonPropertyName("deviceId")]
    public string DeviceId { get; init; } = string.Empty;
}

/// <summary>Auth block returned inside an activation response. Preserved as
/// a stable nested shape so existing consumers (bpp2.0's
/// <c>useSoftwareActivator</c>) keep reading <c>result.Auth.LicenseKey</c>;
/// the v2 wire surfaces <c>licenseKey</c> at the top of the envelope data
/// and the parser reshapes it into this block.</summary>
public sealed record LicenseActivateAuth
{
    /// <summary>License key minted (or reused) for this activation.</summary>
    [JsonPropertyName("licenseKey")]
    public string LicenseKey { get; init; } = string.Empty;
}

/// <summary>Typed response from <see cref="LicenseSubClient.ActivateAsync(LicenseActivateRequest, CancellationToken)"/>.</summary>
public sealed record LicenseActivateResult
{
    /// <summary>Activation outcome (<c>active</c> on success).</summary>
    public string Status { get; init; } = string.Empty;

    /// <summary>Auth credentials minted for the device. The license key is
    /// reshaped from the top-level <c>data.licenseKey</c> on the v2 wire.</summary>
    public LicenseActivateAuth Auth { get; init; } = new();

    /// <summary>Device activations remaining on the order after this call.</summary>
    [JsonPropertyName("remainingActivations")]
    public int RemainingActivations { get; init; }
}

/// <summary>Sub-client exposing the public BPP license-lifecycle surface
/// (PublicActivate, PublicCheck, PublicDeactivate). All three operations
/// target <c>/v2/licenses/*</c> and run as bootstrap calls — no
/// <c>Authorization</c> header, no HMAC signature. The dispatcher attaches
/// only <c>Content-Type</c>, <c>Accept</c>, <c>Idempotency-Key</c>, and
/// (when known) <c>X-Device-ID</c>.</summary>
public sealed class LicenseSubClient
{
    private const string ActivatePath = "/v2/licenses/activate";
    private const string CheckPath = "/v2/licenses/check";
    private const string DeactivatePath = "/v2/licenses/deactivate";
    private const string InactiveStatus = "inactive";
    private const string LegacyDeactivatedStatus = "deactivated";
    private const string ActivateOperation = "license_activate";
    private const string CheckOperation = "license_check";
    private const string DeactivateOperation = "license_deactivate";

    private readonly OperationContext _ctx;
    // Optional credential state — populated only for license-mode Isa
    // instances. When present, the zero-arg overloads fill defaults from
    // the state and the activate path auto-stashes the returned key.
    private readonly IsaCredentialState? _state;

    internal LicenseSubClient(OperationContext ctx) : this(ctx, state: null) { }

    internal LicenseSubClient(OperationContext ctx, IsaCredentialState? state)
    {
        _ctx = ctx;
        _state = state;
    }

    /// <summary>Activate a license on this device. Mints a fresh license key
    /// and, when the client was built with a credential store, stashes the
    /// key + fires <c>OnLicenseRefreshed</c>.</summary>
    public async Task<LicenseActivateResult> ActivateAsync(
        LicenseActivateRequest request,
        CancellationToken ct = default)
    {
        if (request is null) throw new ArgumentNullException(nameof(request));
        if (string.IsNullOrWhiteSpace(request.Email))
            throw new ArgumentException("Email must be non-empty", nameof(request));
        if (string.IsNullOrWhiteSpace(request.Keycode))
            throw new ArgumentException("Keycode must be non-empty", nameof(request));
        if (string.IsNullOrWhiteSpace(request.DeviceId))
            throw new ArgumentException("DeviceId must be non-empty", nameof(request));
        var json = ZyInsJson.Serialize(request);
        var wire = await HttpDispatcher.PostJsonBootstrapAsync<JsonElement>(
            _ctx,
            ActivatePath,
            json,
            "license.activate",
            request.DeviceId,
            DeriveIdempotencyKey(request.DeviceId, ActivateOperation, json),
            ct).ConfigureAwait(false);
        var status = RequiredString(wire, "status", "license.activate");
        if (string.IsNullOrEmpty(status))
        {
            throw new System.Text.Json.JsonException("license.activate response missing status field");
        }
        var result = new LicenseActivateResult
        {
            Status = status,
            Auth = new LicenseActivateAuth { LicenseKey = StringOrEmpty(wire, "licenseKey") },
            RemainingActivations = IntOrZero(wire, "remainingActivations"),
        };
        if (_state is not null && !string.IsNullOrEmpty(result.Auth.LicenseKey))
        {
            await _state.RefreshLicenseKeyAsync(result.Auth.LicenseKey, ct).ConfigureAwait(false);
        }
        return result;
    }

    /// <summary>Ergonomic zero-arg activate. Fills <c>email</c>, <c>keycode</c>,
    /// and <c>deviceId</c> from the parent <see cref="Isa"/>'s credential
    /// state. Throws <see cref="InvalidOperationException"/> when the client
    /// was not constructed in license-mode.</summary>
    public Task<LicenseActivateResult> ActivateAsync(CancellationToken ct = default)
    {
        var state = _state ?? throw new InvalidOperationException(
            "ActivateAsync() with no args requires a license-mode Isa. " +
            "Use Isa.WithLicense(keycode, email) or pass a request explicitly.");
        return ActivateAsync(new LicenseActivateRequest
        {
            Email = state.Email,
            Keycode = state.OrderId,
            DeviceId = state.DeviceId,
        }, ct);
    }

    /// <summary>Phone-home validation. Returns the current license
    /// validation state. Does not require authentication on the wire.</summary>
    /// <exception cref="ArgumentNullException">when <paramref name="request"/> is null.</exception>
    /// <exception cref="ArgumentException">when required fields are empty.</exception>
    public Task<LicenseCheckResult> CheckAsync(LicenseCheckRequest request, CancellationToken ct = default)
    {
        if (request is null) throw new ArgumentNullException(nameof(request));
        if (string.IsNullOrWhiteSpace(request.Email))
            throw new ArgumentException("Email must be non-empty", nameof(request));
        if (string.IsNullOrWhiteSpace(request.Keycode))
            throw new ArgumentException("Keycode must be non-empty", nameof(request));
        var bootstrapDeviceId = DeviceIdForBootstrap(request.DeviceId);
        var json = ZyInsJson.Serialize(request);
        return HttpDispatcher.PostJsonBootstrapAsync<LicenseCheckResult>(
            _ctx,
            CheckPath,
            json,
            "license.check",
            bootstrapDeviceId,
            DeriveIdempotencyKey(bootstrapDeviceId, CheckOperation, json),
            ct);
    }

    /// <summary>Deactivate the license. Resets the anti-piracy device
    /// record and marks the order inactive.</summary>
    public async Task<LicenseDeactivateResult> DeactivateAsync(LicenseDeactivateRequest request, CancellationToken ct = default)
    {
        if (request is null) throw new ArgumentNullException(nameof(request));
        if (string.IsNullOrWhiteSpace(request.Email))
            throw new ArgumentException("Email must be non-empty", nameof(request));
        if (string.IsNullOrWhiteSpace(request.Keycode))
            throw new ArgumentException("Keycode must be non-empty", nameof(request));
        var bootstrapDeviceId = DeviceIdForBootstrap(request.DeviceId);
        var json = ZyInsJson.Serialize(request);
        var wire = await HttpDispatcher.PostJsonBootstrapAsync<JsonElement>(
            _ctx,
            DeactivatePath,
            json,
            "license.deactivate",
            bootstrapDeviceId,
            DeriveIdempotencyKey(bootstrapDeviceId, DeactivateOperation, json),
            ct).ConfigureAwait(false);
        var result = new LicenseDeactivateResult
        {
            Status = StringOrEmpty(wire, "status"),
            RemainingActivations = IntOrZero(wire, "remainingActivations"),
        };
        // v2 returns "inactive"; legacy v1 returned "deactivated". Accept
        // both so a server still serving the old wire word does not break
        // consumers mid-rollout.
        if (!string.Equals(result.Status, InactiveStatus, System.StringComparison.Ordinal)
            && !string.Equals(result.Status, LegacyDeactivatedStatus, System.StringComparison.Ordinal))
        {
            throw new InvalidOperationException($"License deactivation returned unexpected status '{result.Status}'.");
        }
        if (_state is not null)
        {
            await _state.ClearLicenseKeyAsync(ct).ConfigureAwait(false);
        }
        return result;
    }

    /// <summary>Ergonomic zero-arg check. Fills credentials from instance state.</summary>
    public Task<LicenseCheckResult> CheckAsync(CancellationToken ct = default)
    {
        var state = _state ?? throw new InvalidOperationException(
            "CheckAsync() with no args requires a license-mode Isa. " +
            "Use Isa.WithLicense(keycode, email) or pass a request explicitly.");
        return CheckAsync(new LicenseCheckRequest
        {
            Email = state.Email,
            Keycode = state.OrderId,
            DeviceId = state.DeviceId,
            LicenseKey = string.IsNullOrEmpty(state.LicenseKey) ? null : state.LicenseKey,
        }, ct);
    }

    /// <summary>Ergonomic zero-arg deactivate. Fills credentials from instance state.</summary>
    public Task<LicenseDeactivateResult> DeactivateAsync(CancellationToken ct = default)
    {
        var state = _state ?? throw new InvalidOperationException(
            "DeactivateAsync() with no args requires a license-mode Isa. " +
            "Use Isa.WithLicense(keycode, email) or pass a request explicitly.");
        return DeactivateAsync(new LicenseDeactivateRequest
        {
            Email = state.Email,
            Keycode = state.OrderId,
            DeviceId = state.DeviceId,
        }, ct);
    }

    private static string DeriveIdempotencyKey(string? deviceId, string operation, string serializedBody)
    {
        var canonical = $"{deviceId?.Trim() ?? string.Empty}:{operation}:{serializedBody}";
        using var sha = System.Security.Cryptography.SHA256.Create();
        var digest = sha.ComputeHash(System.Text.Encoding.UTF8.GetBytes(canonical));
        return CompatHex.ToLowerHex(digest);
    }

    private string? DeviceIdForBootstrap(string? requestDeviceId)
    {
        return string.IsNullOrWhiteSpace(requestDeviceId) ? _state?.DeviceId : requestDeviceId;
    }

    private static string RequiredString(JsonElement data, string propertyName, string context)
    {
        var value = StringOrEmpty(data, propertyName);
        if (value.Length == 0)
        {
            throw new JsonException($"{context} response missing {propertyName} field");
        }
        return value;
    }

    private static string StringOrEmpty(JsonElement data, string propertyName)
    {
        return data.ValueKind == JsonValueKind.Object
            && data.TryGetProperty(propertyName, out var value)
            && value.ValueKind == JsonValueKind.String
            ? value.GetString() ?? string.Empty
            : string.Empty;
    }

    private static int IntOrZero(JsonElement data, string propertyName)
    {
        return data.ValueKind == JsonValueKind.Object
            && data.TryGetProperty(propertyName, out var value)
            && value.ValueKind == JsonValueKind.Number
            && value.TryGetInt32(out var parsed)
            ? parsed
            : 0;
    }
}

/// <summary>Sub-client exposing the platform readiness probe.</summary>
public sealed class HealthSubClient
{
    private const string ReadinessPath = "/ready";

    private readonly OperationContext _ctx;

    internal HealthSubClient(OperationContext ctx) => _ctx = ctx;

    /// <summary>Query the platform `/ready` endpoint. A 5xx response
    /// surfaces as a typed <see cref="global::Isa.Sdk.Core.IsaException"/>.</summary>
    public Task<ReadinessResult> GetReadinessAsync(CancellationToken ct = default) =>
        HttpDispatcher.GetAsync<ReadinessResult>(_ctx, ReadinessPath, ct: ct);
}
