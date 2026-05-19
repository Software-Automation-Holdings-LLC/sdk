// Common request dispatch: build → sign → send → parse. Every
// sub-client funnels through here so error handling and JSON
// conventions live in one place.
using Sah.Sdk.Core;

namespace Sah.Sdk.Zyins;

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
