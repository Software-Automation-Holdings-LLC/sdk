// Common request dispatch: build → sign → send → parse. Every
// sub-client funnels through here so error handling and JSON
// conventions live in one place.
using System.Text.Json;
using System.Text.Json.Nodes;
using Isa.Sdk.Core;

namespace Isa.Sdk.Zyins;

/// <summary>Internal request dispatcher shared by every sub-client.</summary>
internal static class HttpDispatcher
{
    private const string ContentTypeHeader = "Content-Type";
    private const string AcceptHeader = "Accept";
    private const string JsonMediaType = "application/json";

    /// <summary>Issue a GET and parse the JSON response into <typeparamref name="TResponse"/>.</summary>
    public static async Task<TResponse> GetAsync<TResponse>(
        OperationContext ctx,
        string path,
        IReadOnlyDictionary<string, string?>? query = null,
        CancellationToken ct = default)
    {
        var url = BuildUrl(ctx.BaseUrl, path, query);
        var request = new TransportRequest(
            HttpVerb.Get,
            url,
            new Dictionary<string, string> { [AcceptHeader] = JsonMediaType },
            Body: null);
        return await DispatchAsync<TResponse>(ctx, request, ct).ConfigureAwait(false);
    }

    /// <summary>Issue a POST with a JSON body and parse the JSON response.</summary>
    public static async Task<TResponse> PostJsonAsync<TRequest, TResponse>(
        OperationContext ctx,
        string path,
        TRequest body,
        CancellationToken ct = default)
    {
        var url = BuildUrl(ctx.BaseUrl, path, query: null);
        var json = ZyInsJson.Serialize(body);
        var request = new TransportRequest(
            HttpVerb.Post,
            url,
            new Dictionary<string, string>
            {
                [AcceptHeader] = JsonMediaType,
                [ContentTypeHeader] = JsonMediaType,
            },
            Body: json);
        return await DispatchAsync<TResponse>(ctx, request, ct).ConfigureAwait(false);
    }

    /// <summary>POST JSON and return the full response envelope as JSON.</summary>
    public static async Task<JsonObject> PostEnvelopeAsync<TRequest>(
        OperationContext ctx,
        string path,
        TRequest body,
        CancellationToken ct = default)
    {
        var url = BuildUrl(ctx.BaseUrl, path, query: null);
        var json = ZyInsJson.Serialize(body);
        var request = new TransportRequest(
            HttpVerb.Post,
            url,
            new Dictionary<string, string>
            {
                [ContentTypeHeader] = JsonMediaType,
                [AcceptHeader] = JsonMediaType,
            },
            Body: json);
        var (responseBody, _) = await DispatchRawAsync(ctx, request, ct).ConfigureAwait(false);
        var node = JsonNode.Parse(responseBody);
        if (node is not JsonObject obj)
            throw new JsonException("response body is not a JSON object");
        return obj;
    }

    /// <summary>Issue a POST and parse either a bare body or ADR-012 envelope.</summary>
    public static async Task<TResponse> PostJsonEnvelopeAsync<TRequest, TResponse>(
        OperationContext ctx,
        string path,
        TRequest body,
        string context,
        CancellationToken ct = default)
    {
        var url = BuildUrl(ctx.BaseUrl, path, query: null);
        var json = ZyInsJson.Serialize(body);
        var request = new TransportRequest(
            HttpVerb.Post,
            url,
            new Dictionary<string, string>
            {
                [AcceptHeader] = JsonMediaType,
                [ContentTypeHeader] = JsonMediaType,
            },
            Body: json);
        var (rawBody, _) = await DispatchRawAsync(ctx, request, ct).ConfigureAwait(false);
        return ZyInsJson.DeserializeEnvelope<TResponse>(rawBody, context);
    }

    /// <summary>POST a JSON body to a bootstrap (no-auth) endpoint and parse the
    /// ADR-012 envelope. The signer is bypassed entirely: these endpoints sit
    /// outside AuthMiddleware on the server (e.g. <c>/v2/licenses/activate</c>
    /// is the call that mints the license key, so signing here would require a
    /// credential the client does not yet have). Headers attached:
    /// <c>Content-Type</c>, <c>Accept</c>, <c>Idempotency-Key</c>, and (when
    /// <paramref name="deviceId"/> is non-blank) <c>X-Device-ID</c>. No
    /// <c>Authorization</c>, no <c>X-Device-Signature</c>.</summary>
    public static async Task<TResponse> PostJsonBootstrapAsync<TResponse>(
        OperationContext ctx,
        string path,
        string serializedBody,
        string context,
        string? deviceId,
        string idempotencyKey,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(idempotencyKey))
        {
            throw new ArgumentException("Idempotency key must be non-empty", nameof(idempotencyKey));
        }
        var url = BuildUrl(ctx.BaseUrl, path, query: null);
        var trimmedDeviceId = deviceId?.Trim();
        var headers = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            [AcceptHeader] = JsonMediaType,
            [ContentTypeHeader] = JsonMediaType,
            ["Idempotency-Key"] = idempotencyKey.Trim(),
        };
        if (!string.IsNullOrWhiteSpace(trimmedDeviceId))
        {
            headers["X-Device-ID"] = trimmedDeviceId!;
        }
        var request = new TransportRequest(HttpVerb.Post, url, headers, Body: serializedBody);
        ctx.Logger.LogRequest(request, attempt: 0);
        var response = await ctx.Transport.SendAsync(request, ct).ConfigureAwait(false);
        ctx.Logger.LogResponse(request.Url, response);
        if (response.Status is >= 200 and < 300)
        {
            return ZyInsJson.DeserializeEnvelope<TResponse>(response.Body, context);
        }
        throw ProblemDetailsParser.ToException(response);
    }

    private static async Task<TResponse> DispatchAsync<TResponse>(
        OperationContext ctx,
        TransportRequest request,
        CancellationToken ct)
    {
        var (body, _) = await DispatchRawAsync(ctx, request, ct).ConfigureAwait(false);
        return ZyInsJson.Deserialize<TResponse>(body);
    }

    /// <summary>Dispatch and return the raw response alongside its body. Internal helper
    /// for the <c>WithRawResponseAsync</c> variants.</summary>
    internal static async Task<(string Body, TransportResponse Response)> DispatchRawAsync(
        OperationContext ctx,
        TransportRequest request,
        CancellationToken ct)
    {
        var signed = ctx.Signer.Sign(request);
        ctx.Logger.LogRequest(signed, attempt: 0);
        var response = await ctx.Transport.SendAsync(signed, ct).ConfigureAwait(false);
        ctx.Logger.LogResponse(signed.Url, response);
        if (response.Status is >= 200 and < 300)
        {
            return (response.Body, response);
        }
        throw ProblemDetailsParser.ToException(response);
    }

    /// <summary>POST a JSON body and return both the parsed body and the raw transport response.</summary>
    public static async Task<(TResponse Data, TransportResponse Response)> PostJsonRawAsync<TRequest, TResponse>(
        OperationContext ctx,
        string path,
        TRequest body,
        CancellationToken ct = default)
    {
        var url = BuildUrl(ctx.BaseUrl, path, query: null);
        var json = ZyInsJson.Serialize(body);
        var request = new TransportRequest(
            HttpVerb.Post,
            url,
            new Dictionary<string, string>
            {
                [AcceptHeader] = JsonMediaType,
                [ContentTypeHeader] = JsonMediaType,
            },
            Body: json);
        var (rawBody, rawResp) = await DispatchRawAsync(ctx, request, ct).ConfigureAwait(false);
        return (ZyInsJson.Deserialize<TResponse>(rawBody), rawResp);
    }

    /// <summary>GET and return both the parsed body and the raw transport response.</summary>
    public static async Task<(TResponse Data, TransportResponse Response)> GetRawAsync<TResponse>(
        OperationContext ctx,
        string path,
        IReadOnlyDictionary<string, string?>? query = null,
        CancellationToken ct = default)
    {
        var url = BuildUrl(ctx.BaseUrl, path, query);
        var request = new TransportRequest(
            HttpVerb.Get,
            url,
            new Dictionary<string, string> { [AcceptHeader] = JsonMediaType },
            Body: null);
        var (rawBody, rawResp) = await DispatchRawAsync(ctx, request, ct).ConfigureAwait(false);
        return (ZyInsJson.Deserialize<TResponse>(rawBody), rawResp);
    }

    private static Uri BuildUrl(Uri baseUrl, string path, IReadOnlyDictionary<string, string?>? query)
    {
        var b = new UriBuilder(new Uri(baseUrl, path));
        if (query is not null && query.Count > 0)
        {
            var parts = new List<string>(query.Count);
            foreach (var kv in query)
            {
                if (kv.Value is null) continue;
                parts.Add($"{Uri.EscapeDataString(kv.Key)}={Uri.EscapeDataString(kv.Value)}");
            }
            b.Query = string.Join("&", parts);
        }
        return b.Uri;
    }
}
