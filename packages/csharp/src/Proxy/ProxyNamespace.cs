// Proxy sub-namespace exposing isa.Proxy.CallAsync — structured
// invocation against `/v1/call`, signed with canonical session-
// credential HMAC.
//
// Envelope shape (opaque pass-through; do NOT flatten):
//
//   { integration_id | integration_uuid, method, params }
//
// Auth headers come from SignRequest.Sign (the canonical session
// signer); Idempotency-Key is auto-minted as a UUID v4 when the caller
// omits one. The SDK↔proxy hop is HMAC-signed; the proxy↔downstream
// hop remains Algosure HMAC and is handled server-side (ADR-035,
// amended in PR #<this>).

using System;
using System.Collections.Generic;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Isa.Sdk.Core;

namespace Isa.Sdk.Proxy;

/// <summary>Default origin for the platform proxy `/v1/call` endpoint.</summary>
public static class ProxyDefaults
{
    /// <summary>Production proxy origin.</summary>
    public const string DefaultProxyOrigin = "https://proxy.isaapi.com";
}

/// <summary>Parameterizes one invocation of <see cref="ProxyNamespace.CallAsync"/>.</summary>
public sealed class ProxyCallOptions
{
    /// <summary>Preferred opaque identifier. Mutually exclusive with <see cref="IntegrationId"/>.</summary>
    public string? IntegrationUuid { get; set; }

    /// <summary>Legacy BIGSERIAL identifier. Mutually exclusive with <see cref="IntegrationUuid"/>.</summary>
    public long? IntegrationId { get; set; }

    /// <summary>Opaque JSON-serializable payload forwarded to the downstream integration.</summary>
    public object? Params { get; set; }

    /// <summary>HTTP method the proxy uses against the integration. Defaults to "POST".</summary>
    public string Method { get; set; } = "POST";

    /// <summary>Optional caller-supplied idempotency key; auto-minted as UUID v4 when null.</summary>
    public string? IdempotencyKey { get; set; }
}

/// <summary>
/// Session-signed `/v1/call` entry point reached via <see cref="global::Isa.Sdk.Isa.Proxy"/>.
/// Carries the session binding for the parent <see cref="global::Isa.Sdk.Isa"/>;
/// non-session callers see <see cref="global::Isa.Sdk.Core.IsaConfigException"/>
/// at the boundary so they know to exchange credentials first.
/// </summary>
/// <example>
/// <code>
/// var isa = Isa.WithSession(new SessionOptions { SessionId = "sess_…", SessionSecret = "…" });
/// var body = await isa.Proxy.CallAsync(new ProxyCallOptions
/// {
///     IntegrationUuid = "int_abc",
///     Params = new { foo = "bar" },
/// });
/// </code>
/// </example>
public sealed class ProxyNamespace
{
    /// <summary>The platform proxy invocation path.</summary>
    public const string ProxyCallPath = "/v1/call";

    private static readonly HttpClient SharedHttpClient = new();

    private readonly string? _sessionId;
    private readonly string? _sessionSecret;
    private readonly string _proxyOrigin;
    private readonly HttpClient _httpClient;
    private readonly IClock _clock;
    private readonly Func<string>? _uuidFactory;

    /// <summary>Default constructor — non-session callers see <see cref="IsaConfigException"/> at <see cref="CallAsync"/>.</summary>
    public ProxyNamespace()
        : this(sessionId: null, sessionSecret: null, proxyOrigin: ProxyDefaults.DefaultProxyOrigin, handler: null, clock: null, uuidFactory: null)
    {
    }

    /// <summary>
    /// Construct a session-bound proxy namespace. Used by <see cref="global::Isa.Sdk.Isa"/>
    /// to plumb credentials; tests pass a handler + fixed clock to drive
    /// deterministic outbound assertions.
    /// </summary>
    public ProxyNamespace(
        string? sessionId,
        string? sessionSecret,
        string? proxyOrigin = null,
        HttpMessageHandler? handler = null,
        IClock? clock = null,
        Func<string>? uuidFactory = null)
    {
        _sessionId = sessionId;
        _sessionSecret = sessionSecret;
        _proxyOrigin = string.IsNullOrWhiteSpace(proxyOrigin) ? ProxyDefaults.DefaultProxyOrigin : proxyOrigin!;
        _httpClient = handler is null ? SharedHttpClient : new HttpClient(handler, disposeHandler: false);
        _clock = clock ?? SystemClock.Instance;
        _uuidFactory = uuidFactory;
    }

    /// <summary>
    /// Invoke a registered integration through the platform proxy. Returns
    /// the raw response body as a UTF-8 string (envelope shape is whatever
    /// the server returns).
    /// </summary>
    /// <exception cref="IsaConfigException">When the parent Isa was constructed without a session credential.</exception>
    /// <exception cref="IsaValidationException">When neither/both of IntegrationUuid/IntegrationId are supplied, or on a 400 response.</exception>
    /// <exception cref="IsaAuthException">On a 401 response.</exception>
    /// <exception cref="IsaIdempotencyConflictException">On a 409 idempotency_conflict response.</exception>
    /// <exception cref="IsaException">On any other non-2xx response.</exception>
    public async Task<string> CallAsync(ProxyCallOptions opts, CancellationToken ct = default)
    {
        AssertSessionIdentity();
        ValidateIdentifier(opts);
        var bodyBytes = BuildEnvelopeBody(opts);
        var headers = BuildSignedHeaders(bodyBytes, opts);
        return await SendAsync(bodyBytes, headers, ct).ConfigureAwait(false);
    }

    private void AssertSessionIdentity()
    {
        if (string.IsNullOrEmpty(_sessionId) || string.IsNullOrEmpty(_sessionSecret))
        {
            throw new IsaConfigException(
                "proxy.call requires a Session identity; exchange your bearer/license credentials via account.sessions.create first");
        }
    }

    private static void ValidateIdentifier(ProxyCallOptions opts)
    {
        var hasUuid = !string.IsNullOrWhiteSpace(opts.IntegrationUuid);
        var hasId = opts.IntegrationId.HasValue && opts.IntegrationId.Value > 0;
        if (opts.IntegrationId.HasValue && !hasId)
        {
            throw new IsaValidationException(
                code: "validation_error",
                message: "proxy.call: IntegrationId must be a positive integer",
                param: "integration_id");
        }
        if (hasUuid && hasId)
        {
            throw new IsaValidationException(
                code: "validation_error",
                message: "proxy.call: supply exactly one of IntegrationUuid or IntegrationId",
                param: "integration_uuid");
        }
        if (!hasUuid && !hasId)
        {
            throw new IsaValidationException(
                code: "validation_error",
                message: "proxy.call: supply exactly one of IntegrationUuid or IntegrationId",
                param: "integration_uuid");
        }
    }

    private static byte[] BuildEnvelopeBody(ProxyCallOptions opts)
    {
        var envelope = new Dictionary<string, object?>(3);
        if (!string.IsNullOrWhiteSpace(opts.IntegrationUuid))
        {
            envelope["integration_uuid"] = opts.IntegrationUuid;
        }
        else
        {
            envelope["integration_id"] = opts.IntegrationId;
        }
        envelope["method"] = string.IsNullOrEmpty(opts.Method) ? "POST" : opts.Method;
        envelope["params"] = opts.Params;
        return JsonSerializer.SerializeToUtf8Bytes(envelope);
    }

    private Dictionary<string, string> BuildSignedHeaders(byte[] body, ProxyCallOptions opts)
    {
        var signed = SignRequest.Sign(
            method: "POST",
            path: ProxyCallPath,
            body: body,
            sessionId: _sessionId!,
            sessionSecret: _sessionSecret!,
            clock: _clock);
        return new Dictionary<string, string>(StringComparer.Ordinal)
        {
            [SignedHeaders.AuthorizationHeader] = signed.Authorization,
            [SignedHeaders.IsaSessionIdHeader] = signed.IsaSessionId,
            [SignedHeaders.IsaTimestampHeader] = signed.IsaTimestamp,
            [SignedHeaders.IsaSignatureHeader] = signed.IsaSignature,
            ["Idempotency-Key"] = opts.IdempotencyKey
                ?? (_uuidFactory is null ? Guid.NewGuid().ToString() : _uuidFactory()),
        };
    }

    private async Task<string> SendAsync(
        byte[] body,
        Dictionary<string, string> headers,
        CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Post, _proxyOrigin.TrimEnd('/') + ProxyCallPath)
        {
            Content = new ByteArrayContent(body),
        };
        req.Content.Headers.ContentType = new MediaTypeHeaderValue("application/json");
        foreach (var kv in headers)
        {
            req.Headers.TryAddWithoutValidation(kv.Key, kv.Value);
        }
        using var resp = await _httpClient.SendAsync(req, ct).ConfigureAwait(false);
#if NETSTANDARD2_0
        ct.ThrowIfCancellationRequested();
        var text = await resp.Content.ReadAsStringAsync().ConfigureAwait(false);
#else
        var text = await resp.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
#endif
        if (resp.IsSuccessStatusCode)
        {
            return text;
        }
        throw MapError(resp.StatusCode, text);
    }

    private static Exception MapError(HttpStatusCode status, string body)
    {
        var (code, detail, requestId, key, firstSeenAt) = TryParseProblem(body);
        var pickedCode = string.IsNullOrEmpty(code) ? "api_error" : code!;
        var pickedDetail = string.IsNullOrEmpty(detail) ? body : detail!;
        if (status == HttpStatusCode.Unauthorized)
        {
            return new IsaAuthException(
                code: string.IsNullOrEmpty(code) ? "unauthorized" : code!,
                message: pickedDetail,
                requestId: requestId,
                httpStatus: 401);
        }
        if (status == HttpStatusCode.BadRequest)
        {
            return new IsaValidationException(
                code: string.IsNullOrEmpty(code) ? "validation_error" : code!,
                message: pickedDetail,
                requestId: requestId,
                httpStatus: 400);
        }
        if (status == HttpStatusCode.Conflict && code == "idempotency_conflict")
        {
            return new IsaIdempotencyConflictException(
                key: key ?? string.Empty,
                message: pickedDetail,
                firstSeenAt: firstSeenAt,
                requestId: requestId);
        }
        return new IsaException(
            code: pickedCode,
            message: pickedDetail,
            requestId: requestId,
            httpStatus: (int)status);
    }

    private static (string? code, string? detail, string? requestId, string? key, DateTimeOffset? firstSeenAt) TryParseProblem(string body)
    {
        if (string.IsNullOrWhiteSpace(body))
        {
            return (null, null, null, null, null);
        }
        try
        {
            using var doc = JsonDocument.Parse(body);
            var root = doc.RootElement;
            string? StringOr(string name) =>
                root.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;
            return (
                StringOr("code"),
                StringOr("detail") ?? StringOr("message"),
                StringOr("request_id"),
                StringOr("key"),
                DateTimeOffset.TryParse(StringOr("first_seen_at"), out var parsed) ? parsed : null);
        }
        catch (JsonException)
        {
            return (null, null, null, null, null);
        }
    }
}
