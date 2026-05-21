// Licenses + Health sub-clients.
//
// Licenses targets the public BPP license-lifecycle endpoints
// `/v1/licenses/check` and `/v1/licenses/deactivate` defined in
// shared/schemas/api/zyins/v1/licenses.proto.
//
// Health targets the shared platform readiness probe `/ready` defined
// in shared/schemas/api/isa/v1/health.proto. The probe is
// unauthenticated; an attached bearer header is harmless and lets one
// client serve every operation.
using System.Text.Json.Serialization;

namespace Sah.Sdk.Zyins;

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

/// <summary>Typed request for <see cref="LicensesSubClient.CheckAsync(LicensesCheckRequest, CancellationToken)"/>.</summary>
public sealed record LicensesCheckRequest
{
    /// <summary>Email associated with the license. Required.</summary>
    public string Email { get; init; } = string.Empty;

    /// <summary>BPP order keycode (XXX-XXX-XXX). Required.</summary>
    public string Keycode { get; init; } = string.Empty;

    /// <summary>Optional client-generated device fingerprint.</summary>
    [JsonPropertyName("device_id")]
    public string? DeviceId { get; init; }

    /// <summary>Optional license key to verify.</summary>
    [JsonPropertyName("license_key")]
    public string? LicenseKey { get; init; }
}

/// <summary>Typed response from <see cref="LicensesSubClient.CheckAsync(LicensesCheckRequest, CancellationToken)"/>.</summary>
public sealed record LicensesCheckResult
{
    /// <summary>Validation outcome as the raw wire value (`valid`, `invalid`, `inactive`).</summary>
    public string Status { get; init; } = string.Empty;

    /// <summary>Typed accessor for <see cref="Status"/>.</summary>
    [JsonIgnore]
    public LicenseValidationStatus ValidationStatus => Status switch
    {
        "valid" => LicenseValidationStatus.Valid,
        "invalid" => LicenseValidationStatus.Invalid,
        "inactive" => LicenseValidationStatus.Inactive,
        _ => LicenseValidationStatus.Unknown,
    };
}

/// <summary>Typed request for <see cref="LicensesSubClient.DeactivateAsync(LicensesDeactivateRequest, CancellationToken)"/>.</summary>
public sealed record LicensesDeactivateRequest
{
    /// <summary>Email associated with the license. Required.</summary>
    public string Email { get; init; } = string.Empty;

    /// <summary>BPP order keycode. Required.</summary>
    public string Keycode { get; init; } = string.Empty;

    /// <summary>Optional device fingerprint; reset on success.</summary>
    [JsonPropertyName("device_id")]
    public string? DeviceId { get; init; }
}

/// <summary>Typed response from <see cref="LicensesSubClient.DeactivateAsync(LicensesDeactivateRequest, CancellationToken)"/>.</summary>
public sealed record LicensesDeactivateResult
{
    /// <summary>Always `deactivated` on success.</summary>
    public string Status { get; init; } = string.Empty;
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

/// <summary>Typed request for <see cref="LicensesSubClient.ActivateAsync(LicensesActivateRequest, CancellationToken)"/>.</summary>
public sealed record LicensesActivateRequest
{
    /// <summary>Email associated with the license. Required.</summary>
    public string Email { get; init; } = string.Empty;

    /// <summary>BPP order keycode in XXX-XXX-XXX format. Required.</summary>
    public string Keycode { get; init; } = string.Empty;

    /// <summary>Client-generated device fingerprint. Required.</summary>
    [JsonPropertyName("device_id")]
    public string DeviceId { get; init; } = string.Empty;
}

/// <summary>Auth block returned inside an activation response.</summary>
public sealed record LicensesActivateAuth
{
    /// <summary>License key minted (or reused) for this activation.</summary>
    [JsonPropertyName("license_key")]
    public string LicenseKey { get; init; } = string.Empty;
}

/// <summary>Typed response from <see cref="LicensesSubClient.ActivateAsync(LicensesActivateRequest, CancellationToken)"/>.</summary>
public sealed record LicensesActivateResult
{
    /// <summary>Activation outcome (<c>active</c> on success).</summary>
    public string Status { get; init; } = string.Empty;

    /// <summary>Auth credentials minted for the device.</summary>
    public LicensesActivateAuth Auth { get; init; } = new();

    /// <summary>Device activations remaining on the order after this call.</summary>
    [JsonPropertyName("remaining_activations")]
    public int RemainingActivations { get; init; }
}

/// <summary>Sub-client exposing the public BPP license-lifecycle surface
/// (PublicActivate, PublicCheck, PublicDeactivate). The authenticated
/// self-* surface lands with the LicenseHMAC transport in a follow-up PR.</summary>
public sealed class LicensesSubClient
{
    private const string ActivatePath = "/v1/licenses/activate";
    private const string CheckPath = "/v1/licenses/check";
    private const string DeactivatePath = "/v1/licenses/deactivate";
    private const string DeactivatedStatus = "deactivated";

    private readonly OperationContext _ctx;
    // Optional credential state — populated only for license-mode Isa
    // instances. When present, the zero-arg overloads fill defaults from
    // the state and the activate path auto-stashes the returned key.
    private readonly IsaCredentialState? _state;

    internal LicensesSubClient(OperationContext ctx) : this(ctx, state: null) { }

    internal LicensesSubClient(OperationContext ctx, IsaCredentialState? state)
    {
        _ctx = ctx;
        _state = state;
    }

    /// <summary>Activate a license on this device. Mints a fresh license key
    /// and, when the client was built with a credential store, stashes the
    /// key + fires <c>OnLicenseRefreshed</c>.</summary>
    public async Task<LicensesActivateResult> ActivateAsync(
        LicensesActivateRequest request,
        CancellationToken ct = default)
    {
        if (request is null) throw new ArgumentNullException(nameof(request));
        if (string.IsNullOrWhiteSpace(request.Email))
            throw new ArgumentException("Email must be non-empty", nameof(request));
        if (string.IsNullOrWhiteSpace(request.Keycode))
            throw new ArgumentException("Keycode must be non-empty", nameof(request));
        if (string.IsNullOrWhiteSpace(request.DeviceId))
            throw new ArgumentException("DeviceId must be non-empty", nameof(request));
        var result = await HttpDispatcher.PostJsonEnvelopeAsync<LicensesActivateRequest, LicensesActivateResult>(
            _ctx, ActivatePath, request, "licenses.activate", ct).ConfigureAwait(false);
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
    public Task<LicensesActivateResult> ActivateAsync(CancellationToken ct = default)
    {
        var state = _state ?? throw new InvalidOperationException(
            "ActivateAsync() with no args requires a license-mode Isa. " +
            "Use Isa.WithLicense(keycode, email) or pass a request explicitly.");
        return ActivateAsync(new LicensesActivateRequest
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
    public Task<LicensesCheckResult> CheckAsync(LicensesCheckRequest request, CancellationToken ct = default)
    {
        if (request is null) throw new ArgumentNullException(nameof(request));
        if (string.IsNullOrWhiteSpace(request.Email))
            throw new ArgumentException("Email must be non-empty", nameof(request));
        if (string.IsNullOrWhiteSpace(request.Keycode))
            throw new ArgumentException("Keycode must be non-empty", nameof(request));
        return HttpDispatcher.PostJsonEnvelopeAsync<LicensesCheckRequest, LicensesCheckResult>(
            _ctx,
            CheckPath,
            request,
            "licenses.check",
            ct);
    }

    /// <summary>Deactivate the license. Resets the anti-piracy device
    /// record and marks the order inactive.</summary>
    public async Task<LicensesDeactivateResult> DeactivateAsync(LicensesDeactivateRequest request, CancellationToken ct = default)
    {
        if (request is null) throw new ArgumentNullException(nameof(request));
        if (string.IsNullOrWhiteSpace(request.Email))
            throw new ArgumentException("Email must be non-empty", nameof(request));
        if (string.IsNullOrWhiteSpace(request.Keycode))
            throw new ArgumentException("Keycode must be non-empty", nameof(request));
        var result = await HttpDispatcher.PostJsonEnvelopeAsync<LicensesDeactivateRequest, LicensesDeactivateResult>(
            _ctx,
            DeactivatePath,
            request,
            "licenses.deactivate",
            ct).ConfigureAwait(false);
        if (!string.Equals(result.Status, DeactivatedStatus, System.StringComparison.Ordinal))
            throw new InvalidOperationException($"License deactivation returned unexpected status '{result.Status}'.");
        if (_state is not null)
        {
            await _state.ClearLicenseKeyAsync(ct).ConfigureAwait(false);
        }
        return result;
    }

    /// <summary>Ergonomic zero-arg check. Fills credentials from instance state.</summary>
    public Task<LicensesCheckResult> CheckAsync(CancellationToken ct = default)
    {
        var state = _state ?? throw new InvalidOperationException(
            "CheckAsync() with no args requires a license-mode Isa. " +
            "Use Isa.WithLicense(keycode, email) or pass a request explicitly.");
        return CheckAsync(new LicensesCheckRequest
        {
            Email = state.Email,
            Keycode = state.OrderId,
            DeviceId = state.DeviceId,
            LicenseKey = string.IsNullOrEmpty(state.LicenseKey) ? null : state.LicenseKey,
        }, ct);
    }

    /// <summary>Ergonomic zero-arg deactivate. Fills credentials from instance state.</summary>
    public Task<LicensesDeactivateResult> DeactivateAsync(CancellationToken ct = default)
    {
        var state = _state ?? throw new InvalidOperationException(
            "DeactivateAsync() with no args requires a license-mode Isa. " +
            "Use Isa.WithLicense(keycode, email) or pass a request explicitly.");
        return DeactivateAsync(new LicensesDeactivateRequest
        {
            Email = state.Email,
            Keycode = state.OrderId,
            DeviceId = state.DeviceId,
        }, ct);
    }
}

/// <summary>Sub-client exposing the platform readiness probe.</summary>
public sealed class HealthSubClient
{
    private const string ReadinessPath = "/ready";

    private readonly OperationContext _ctx;

    internal HealthSubClient(OperationContext ctx) => _ctx = ctx;

    /// <summary>Query the platform `/ready` endpoint. A 5xx response
    /// surfaces as a typed <see cref="Sah.Sdk.Core.IsaException"/>.</summary>
    public Task<ReadinessResult> GetReadinessAsync(CancellationToken ct = default) =>
        HttpDispatcher.GetAsync<ReadinessResult>(_ctx, ReadinessPath, ct: ct);
}
