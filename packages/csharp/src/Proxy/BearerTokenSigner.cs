// Bearer-token request signing. The ZyINS public API accepts a single
// `Authorization: Bearer <token>` header; this helper is the only
// place that knows the header name and the "Bearer " prefix so call
// sites never spell either inline.
using Isa.Sdk.Core;

namespace Isa.Sdk.Proxy;

/// <summary>Apply <c>Authorization: Bearer &lt;token&gt;</c> to outgoing requests.</summary>
public sealed class BearerTokenSigner
{
    private const string AuthorizationHeader = "Authorization";
    private const string BearerPrefix = "Bearer ";

    private readonly string _token;

    /// <summary>Construct with the API token (e.g. <c>isa_live_…</c>).</summary>
    public BearerTokenSigner(string token)
    {
        if (string.IsNullOrWhiteSpace(token))
            throw new ArgumentException("token must be non-empty", nameof(token));
        _token = token;
    }

    /// <summary>Return a copy of <paramref name="request"/> with the bearer header set.</summary>
    public TransportRequest Sign(TransportRequest request)
    {
        var headers = CompatHeaders.Copy(request.Headers);
        headers[AuthorizationHeader] = BearerPrefix + _token;
        return request with { Headers = headers };
    }
}
