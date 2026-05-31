// RFC 7807 Problem Details parsing helper. Lives in Core so every
// product SDK funnels error responses through the same logic.
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Isa.Sdk.Core;

/// <summary>Wire shape of the RFC 7807 error body the API returns.</summary>
public sealed record ProblemDetails
{
    /// <summary>Stable machine-readable code (the field consumers switch on).</summary>
    [JsonPropertyName("code")]
    public string? Code { get; init; }

    /// <summary>Human-readable summary; may change between releases.</summary>
    [JsonPropertyName("title")]
    public string? Title { get; init; }

    /// <summary>Human-readable detail; may change between releases.</summary>
    [JsonPropertyName("detail")]
    public string? Detail { get; init; }

    /// <summary>JSON-pointer to the failing field for validation errors.</summary>
    [JsonPropertyName("param")]
    public string? Param { get; init; }

    /// <summary>Engine request id for correlation.</summary>
    [JsonPropertyName("request_id")]
    public string? RequestId { get; init; }

    /// <summary>HTTP status (echoed for client correlation).</summary>
    [JsonPropertyName("status")]
    public int? Status { get; init; }

    /// <summary>Link to the per-code remediation page.</summary>
    [JsonPropertyName("doc_url")]
    public string? DocUrl { get; init; }

    /// <summary>Idempotency key on conflicts; echoes <c>X-Isa-Idempotency-Key</c>.</summary>
    [JsonPropertyName("idempotency_key")]
    public string? IdempotencyKey { get; init; }

    /// <summary>UTC instant the server first saw the idempotency key, for conflict responses.</summary>
    [JsonPropertyName("first_seen_at")]
    public DateTimeOffset? FirstSeenAt { get; init; }
}

/// <summary>Parse an HTTP error response into the right <see cref="IsaException"/> subclass.</summary>
public static class ProblemDetailsParser
{
    private static readonly JsonSerializerOptions Options = new() { PropertyNameCaseInsensitive = true };

    /// <summary>Map a non-2xx <see cref="TransportResponse"/> to an exception.</summary>
    public static IsaException ToException(TransportResponse response)
    {
        ProblemDetails? problem = null;
        try
        {
            if (!string.IsNullOrWhiteSpace(response.Body))
            {
                problem = JsonSerializer.Deserialize<ProblemDetails>(response.Body, Options);
            }
        }
        catch (JsonException)
        {
            // Body was not JSON — fall through to the status-based mapping.
        }

        var code = problem?.Code ?? CodeForStatus(response.Status);
        var message = problem?.Detail ?? problem?.Title ?? $"HTTP {response.Status}";
        var requestId = problem?.RequestId ?? (response.Headers.TryGetValue("X-Request-Id", out var rid) ? rid : null);

        return response.Status switch
        {
            401 => new IsaAuthException(code, message, requestId, response.Status),
            403 when LooksLikeLicense(code) => new IsaLicenseException(code, message, requestId, response.Status),
            403 => new IsaAuthException(code, message, requestId, response.Status),
            400 => new IsaValidationException(code, message, problem?.Param, requestId, response.Status),
            422 => new IsaValidationException(code, message, problem?.Param, requestId, response.Status),
            409 when string.Equals(code, ErrorCodes.ToWire(ErrorCode.IdempotencyConflict), StringComparison.OrdinalIgnoreCase) =>
                new IsaIdempotencyConflictException(
                    problem?.IdempotencyKey ?? IdempotencyKeyFromHeaders(response.Headers) ?? string.Empty,
                    message,
                    problem?.FirstSeenAt,
                    requestId),
            429 => new IsaRateLimitException(code, message, ParseRetryAfter(response.Headers), requestId, response.Status),
            _ => new IsaException(code, message, requestId, response.Status),
        };
    }

    private static string? IdempotencyKeyFromHeaders(IReadOnlyDictionary<string, string> headers) =>
        headers.TryGetValue("X-Isa-Idempotency-Key", out var v) ? v : null;

    private static bool LooksLikeLicense(string code) =>
        code.StartsWith("license_", StringComparison.OrdinalIgnoreCase) ||
        code.Equals("license_expired", StringComparison.OrdinalIgnoreCase) ||
        code.Equals("license_revoked", StringComparison.OrdinalIgnoreCase);

    private static string CodeForStatus(int status) => status switch
    {
        400 => "validation_error",
        401 => "unauthorized",
        403 => "forbidden",
        404 => "not_found",
        409 => "conflict",
        422 => "validation_error",
        429 => ErrorCodes.ToWire(ErrorCode.RateLimited),
        >= 500 => "internal_error",
        _ => "http_error",
    };

    private static TimeSpan? ParseRetryAfter(IReadOnlyDictionary<string, string> headers)
    {
        if (!headers.TryGetValue("Retry-After", out var raw))
            return null;
        if (int.TryParse(raw, out var seconds))
            return TimeSpan.FromSeconds(seconds);
        return null;
    }
}
