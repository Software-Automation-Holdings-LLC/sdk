// Response envelope (SDK_DESIGN.md §4.6). Every method returns one of
// these so the caller always has the request id, idempotency key, and
// retry attempt count alongside their data — Stripe/Anthropic-style.
using Isa.Sdk.Core;

namespace Isa.Sdk.Zyins;

/// <summary>Typed wrapper around a successful response. Exposes the
/// machine-correlation fields (<see cref="RequestId"/>,
/// <see cref="IdempotencyKey"/>, <see cref="RetryAttempts"/>) alongside the parsed data.</summary>
/// <typeparam name="T">Concrete response payload type.</typeparam>
public sealed record Envelope<T>(
    T Data,
    string RequestId,
    string? IdempotencyKey,
    int RetryAttempts,
    bool Livemode);

/// <summary>Raw HTTP response surface returned by every <c>WithRawResponseAsync</c> variant.
/// Exposes the same fields integrators reach for in Stripe / OpenAI / Anthropic SDKs.</summary>
public sealed record RawResponse(
    int StatusCode,
    IReadOnlyDictionary<string, string> Headers,
    Uri RequestUri,
    string Body)
{
    /// <summary>Construct from the lower-level <see cref="TransportResponse"/> + request URL.</summary>
    public static RawResponse FromTransport(TransportResponse response, Uri requestUri) =>
        new(response.Status, response.Headers, requestUri, response.Body);
}
