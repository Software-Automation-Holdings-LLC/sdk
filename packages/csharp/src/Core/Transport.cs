// HTTP transport facade. Direct HttpClient construction is forbidden
// in the SDK call sites; every client takes an ITransport that tests
// can replace with a fake.
using System.Net.Http.Headers;
using System.Text;

namespace Sah.Sdk.Core;

/// <summary>The set of HTTP verbs the SDK ever issues.</summary>
public enum HttpVerb
{
    Get,
    Post,
    Put,
    Delete,
    Patch,
}

/// <summary>One HTTP request as the SDK describes it before signing.</summary>
public sealed record TransportRequest(
    HttpVerb Method,
    Uri Url,
    IReadOnlyDictionary<string, string> Headers,
    string? Body);

/// <summary>The raw HTTP response shape the SDK consumes.</summary>
public sealed record TransportResponse(
    int Status,
    IReadOnlyDictionary<string, string> Headers,
    string Body,
    byte[]? BodyBytes = null);

/// <summary>Injectable transport. Default is <see cref="HttpClientTransport"/>.</summary>
public interface ITransport
{
    /// <summary>Issue a single request and return the response.</summary>
    Task<TransportResponse> SendAsync(TransportRequest request, CancellationToken ct = default);
}

/// <summary>The production transport, backed by a shared <see cref="HttpClient"/>.</summary>
public sealed class HttpClientTransport : ITransport
{
    private readonly HttpClient _client;

    /// <summary>Wrap a caller-supplied <see cref="HttpClient"/>.</summary>
    public HttpClientTransport(HttpClient client) => _client = client;

    /// <summary>Create a transport with a fresh <see cref="HttpClient"/> and the supplied timeout.</summary>
    public static HttpClientTransport Default(TimeSpan? timeout = null)
    {
        var c = new HttpClient { Timeout = timeout ?? TimeSpan.FromSeconds(30) };
        return new HttpClientTransport(c);
    }

    /// <inheritdoc />
    public async Task<TransportResponse> SendAsync(TransportRequest request, CancellationToken ct = default)
    {
        using var msg = new HttpRequestMessage(MapVerb(request.Method), request.Url);
        foreach (var kv in request.Headers)
        {
            // Authorization and other restricted headers must go on the request, not content.
            if (!msg.Headers.TryAddWithoutValidation(kv.Key, kv.Value))
            {
                // Content-Type and friends will be set when we attach the body below.
                if (!string.Equals(kv.Key, "Content-Type", StringComparison.OrdinalIgnoreCase))
                {
                    msg.Headers.TryAddWithoutValidation(kv.Key, kv.Value);
                }
            }
        }
        if (request.Body is not null)
        {
            var contentType = request.Headers.TryGetValue("Content-Type", out var ct0) ? ct0 : "application/json";
            msg.Content = new StringContent(request.Body, Encoding.UTF8);
            msg.Content.Headers.ContentType = MediaTypeHeaderValue.Parse(contentType);
        }
        using var resp = await _client.SendAsync(msg, ct).ConfigureAwait(false);
        // HttpContent.ReadAsStringAsync(CancellationToken) lands in .NET 5;
        // on netstandard2.0 the no-arg overload is the only option, so we
        // pre-check the token to honour caller cancellation semantics.
#if NETSTANDARD2_0
        ct.ThrowIfCancellationRequested();
        var bodyBytes = await resp.Content.ReadAsByteArrayAsync().ConfigureAwait(false);
#else
        var bodyBytes = await resp.Content.ReadAsByteArrayAsync(ct).ConfigureAwait(false);
#endif
        var body = Encoding.UTF8.GetString(bodyBytes);
        var headers = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var h in resp.Headers)
        {
            headers[h.Key] = string.Join(",", h.Value);
        }
        foreach (var h in resp.Content.Headers)
        {
            headers[h.Key] = string.Join(",", h.Value);
        }
        return new TransportResponse((int)resp.StatusCode, headers, body, bodyBytes);
    }

    private static HttpMethod MapVerb(HttpVerb v) => v switch
    {
        HttpVerb.Get => HttpMethod.Get,
        HttpVerb.Post => HttpMethod.Post,
        HttpVerb.Put => HttpMethod.Put,
        HttpVerb.Delete => HttpMethod.Delete,
        // HttpMethod.Patch is in-box on net5.0+. On netstandard2.0 we
        // construct it explicitly; the wire verb is identical.
#if NETSTANDARD2_0
        HttpVerb.Patch => new HttpMethod("PATCH"),
#else
        HttpVerb.Patch => HttpMethod.Patch,
#endif
        _ => throw new ArgumentOutOfRangeException(nameof(v), v, "unsupported verb"),
    };
}
