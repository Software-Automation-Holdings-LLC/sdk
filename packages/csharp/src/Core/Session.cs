// Steady-state session module + transparent auto-refresh interceptor.
//
// Pairs with Bootstrap.Build (the byte-pinned HMAC algorithm) and
// SignRequest.Sign (per-request signing).
//
// Consumer view: never call SessionStore.BootstrapAsync directly. The
// SessionInterceptor wraps an inner ITransport and fires bootstrap on
// miss/expiry, retries once on 401 session_expired, and collapses
// concurrent cold-start callers onto a single round-trip via a
// SemaphoreSlim + double-checked cache.
//
// The 30-second grace overlap lives server-side
// (services/account/internal/handler/sessions_bootstrap.go); the
// client just retries on 401 and never tracks the previous secret.

using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Isa.Sdk.Core;

/// <summary>
/// Cached credential bundle returned by POST /v1/sessions. The Secret
/// is the HMAC key used to sign every steady-state request — treat as
/// a credential: never log, never persist beyond memory.
/// </summary>
public sealed record Session(
    string SessionId,
    string SessionSecret,
    DateTimeOffset ExpiresAt);

/// <summary>Inputs the bootstrap signature needs.</summary>
public sealed record SessionExchangeInput(
    string Keycode,
    string Email,
    string LicenseKey,
    string DeviceId);

/// <summary>Thrown when POST /v1/sessions returns non-2xx.</summary>
public sealed class SessionExchangeException : Exception
{
    public int Status { get; }

    public SessionExchangeException(int status, string message) : base(message)
    {
        Status = status;
    }
}

/// <summary>
/// Atomic session cache + single-flight bootstrap driver.
///
/// Thread-safe; one <see cref="SessionStore"/> per SDK client.
/// <see cref="SemaphoreSlim"/>(1,1) guards the bootstrap critical
/// section; a double-checked read of <see cref="CurrentSecret"/>
/// inside the semaphore collapses concurrent cold-start callers onto
/// the same round-trip.
/// </summary>
public sealed class SessionStore : IDisposable
{
    /// <summary>How close to expiry <see cref="OnActivityAsync"/> proactively re-mints.</summary>
    public static readonly TimeSpan ProactiveWindow = TimeSpan.FromMinutes(5);

    private readonly ITransport _transport;
    private readonly IClock _clock;
    private readonly string _baseUrl;
    private readonly SessionExchangeInput _input;
    private readonly SemaphoreSlim _gate = new(1, 1);
    private Session? _current;
    private int _bootstrapCount;

    public SessionStore(
        ITransport transport,
        string baseUrl,
        SessionExchangeInput input,
        IClock? clock = null)
    {
        if (transport is null)
        {
            throw new ArgumentNullException(nameof(transport));
        }
        if (input is null)
        {
            throw new ArgumentNullException(nameof(input));
        }
        if (string.IsNullOrWhiteSpace(baseUrl))
        {
            throw new ArgumentException(
                "SessionStore: baseUrl must be non-empty",
                nameof(baseUrl));
        }
        if (string.IsNullOrWhiteSpace(input.Keycode) ||
            string.IsNullOrWhiteSpace(input.Email) ||
            string.IsNullOrWhiteSpace(input.LicenseKey) ||
            string.IsNullOrWhiteSpace(input.DeviceId))
        {
            throw new ArgumentException(
                "SessionStore: ExchangeInput requires non-empty keycode, email, licenseKey, deviceId",
                nameof(input));
        }
        _transport = transport;
        _clock = clock ?? SystemClock.Instance;
        _baseUrl = baseUrl.TrimEnd('/');
        _input = input;
    }

    /// <summary>
    /// Number of network bootstraps performed. Tests assert exactly 1
    /// after 10 concurrent product calls — the single-flight invariant.
    /// </summary>
    public int BootstrapCount => Volatile.Read(ref _bootstrapCount);

    /// <summary>Return the cached session if present and not past expiry.</summary>
    public Session? CurrentSecret()
    {
        var cur = Volatile.Read(ref _current);
        if (cur is null)
        {
            return null;
        }
        if (_clock.UtcNow() >= cur.ExpiresAt)
        {
            return null;
        }
        return cur;
    }

    /// <summary>
    /// Perform POST /v1/sessions with the embedded HMAC signature.
    /// Concurrent callers serialize on a SemaphoreSlim; the second
    /// arriver observes the freshly-cached session and skips the
    /// network call.
    /// </summary>
    public async Task<Session> BootstrapAsync(CancellationToken ct = default)
    {
        return await BootstrapAsync(forceRefresh: false, ct).ConfigureAwait(false);
    }

    private async Task<Session> BootstrapAsync(bool forceRefresh, CancellationToken ct)
    {
        await _gate.WaitAsync(ct).ConfigureAwait(false);
        try
        {
            var cur = _current;
            if (!forceRefresh && cur is not null && _clock.UtcNow() < cur.ExpiresAt)
            {
                return cur;
            }
            var sess = await DoExchangeAsync(ct).ConfigureAwait(false);
            Volatile.Write(ref _current, sess);
            Interlocked.Increment(ref _bootstrapCount);
            return sess;
        }
        finally
        {
            _gate.Release();
        }
    }

    /// <summary>Clear the cached session. Called by the interceptor on 401.</summary>
    public void Invalidate()
    {
        Volatile.Write(ref _current, null);
    }

    /// <summary>
    /// Consumer-facing proactive-refresh hook. If the cached session
    /// is within <see cref="ProactiveWindow"/> of expiry, re-mint now.
    /// </summary>
    public async Task OnActivityAsync(CancellationToken ct = default)
    {
        var cur = Volatile.Read(ref _current);
        if (cur is null)
        {
            await BootstrapAsync(ct).ConfigureAwait(false);
            return;
        }
        if (_clock.UtcNow() + ProactiveWindow >= cur.ExpiresAt)
        {
            await BootstrapAsync(forceRefresh: true, ct).ConfigureAwait(false);
        }
    }

    private async Task<Session> DoExchangeAsync(CancellationToken ct)
    {
        var ts = _clock.UtcNow().ToUnixTimeSeconds();
        var sig = Bootstrap.Build(new BootstrapInput(
            Keycode: _input.Keycode,
            Email: _input.Email,
            LicenseKey: _input.LicenseKey,
            DeviceId: _input.DeviceId,
            Method: "POST",
            Path: "/v1/sessions",
            Timestamp: ts));
        var headers = new Dictionary<string, string>
        {
            ["Content-Type"] = "application/json",
            ["X-Device-ID"] = _input.DeviceId,
            ["ISA-Signature"] = string.Format(
                CultureInfo.InvariantCulture, "t={0},v1={1}", ts, sig.Hex),
        };
        var req = new TransportRequest(
            Method: HttpVerb.Post,
            Url: new Uri(_baseUrl + "/v1/sessions"),
            Headers: headers,
            Body: sig.SerializedBody);
        var resp = await _transport.SendAsync(req, ct).ConfigureAwait(false);
        if (resp.Status < 200 || resp.Status >= 300)
        {
            throw new SessionExchangeException(
                resp.Status,
                string.Format(
                    CultureInfo.InvariantCulture,
                    "SessionStore: POST /v1/sessions returned {0}: {1}",
                    resp.Status,
                    Truncate(resp.Body, 200)));
        }
        var envelope = JsonSerializer.Deserialize<BootstrapResponseEnvelope>(
            resp.Body, JsonOptions);
        var payload = envelope?.Data;
        if (payload is null ||
            string.IsNullOrEmpty(payload.SessionId) ||
            string.IsNullOrEmpty(payload.SessionSecret) ||
            string.IsNullOrEmpty(payload.ExpiresAt))
        {
            throw new SessionExchangeException(
                resp.Status,
                "SessionStore: response missing sessionId/sessionSecret/expiresAt");
        }
        if (!DateTimeOffset.TryParse(
            payload.ExpiresAt,
            CultureInfo.InvariantCulture,
            DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal,
            out var expiresAt))
        {
            throw new SessionExchangeException(
                resp.Status,
                "SessionStore: response has invalid expiresAt");
        }
        return new Session(payload.SessionId, payload.SessionSecret, expiresAt);
    }

    private static string Truncate(string s, int max) =>
        s.Length <= max ? s : s.Substring(0, max);

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = null,
        PropertyNameCaseInsensitive = false,
    };

    private sealed record BootstrapResponseEnvelope(
        [property: JsonPropertyName("data")] BootstrapResponseBody? Data);

    private sealed record BootstrapResponseBody(
        [property: JsonPropertyName("sessionId")] string SessionId,
        [property: JsonPropertyName("sessionSecret")] string SessionSecret,
        [property: JsonPropertyName("expiresAt")] string ExpiresAt);

    public void Dispose() => _gate.Dispose();
}

/// <summary>
/// Transparent <see cref="ITransport"/> wrapper that signs every
/// outbound product request with the cached session and retries once
/// on 401 session_expired.
///
/// Wiring at the transport seam means every existing product method
/// (zyins, account, rapidsign, proxy) inherits auto-refresh without
/// per-method changes — they already go through ITransport.
/// </summary>
public sealed class SessionInterceptor : ITransport
{
    private readonly SessionStore _store;
    private readonly ITransport _inner;

    public SessionInterceptor(SessionStore store, ITransport inner)
    {
        if (store is null)
        {
            throw new ArgumentNullException(nameof(store));
        }
        if (inner is null)
        {
            throw new ArgumentNullException(nameof(inner));
        }
        _store = store;
        _inner = inner;
    }

    public async Task<TransportResponse> SendAsync(
        TransportRequest request, CancellationToken ct = default)
    {
        var resp = await SignAndSendAsync(request, ct).ConfigureAwait(false);
        if (!IsSessionExpired(resp))
        {
            return resp;
        }
        _store.Invalidate();
        return await SignAndSendAsync(request, ct).ConfigureAwait(false);
    }

    private async Task<TransportResponse> SignAndSendAsync(
        TransportRequest request, CancellationToken ct)
    {
        var sess = _store.CurrentSecret()
            ?? await _store.BootstrapAsync(ct).ConfigureAwait(false);
        var path = request.Url.PathAndQuery;
        var body = request.Body ?? string.Empty;
        var signed = SignRequest.Sign(
            method: request.Method.ToString().ToUpperInvariant(),
            path: path,
            body: body,
            sessionId: sess.SessionId,
            sessionSecret: sess.SessionSecret);
        var merged = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var kv in request.Headers)
        {
            merged[kv.Key] = kv.Value;
        }
        foreach (var kv in signed.AsDictionary())
        {
            merged[kv.Key] = kv.Value;
        }
        var signedReq = request with { Headers = merged };
        return await _inner.SendAsync(signedReq, ct).ConfigureAwait(false);
    }

    private static bool IsSessionExpired(TransportResponse resp)
    {
        if (resp.Status != 401)
        {
            return false;
        }
        if (!TryGetContentType(resp, out var ct) ||
            ct.IndexOf("json", StringComparison.OrdinalIgnoreCase) < 0)
        {
            return false;
        }
        try
        {
            using var doc = JsonDocument.Parse(resp.Body);
            return doc.RootElement.TryGetProperty("code", out var codeEl)
                && codeEl.ValueKind == JsonValueKind.String
                && codeEl.GetString() == "session_expired";
        }
        catch (JsonException)
        {
            return false;
        }
    }

    private static bool TryGetContentType(TransportResponse resp, out string value)
    {
        if (resp.Headers.TryGetValue("Content-Type", out var v) ||
            resp.Headers.TryGetValue("content-type", out v))
        {
            value = v;
            return true;
        }
        value = string.Empty;
        return false;
    }
}
