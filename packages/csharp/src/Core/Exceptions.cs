// Base exception hierarchy shared across IsaSdk.* packages. Concrete
// subclasses live in product packages (ZyINS, Proxy, ...) so each can
// add domain-specific fields without bloating Core.
namespace Isa.Sdk.Core;

/// <summary>Root of the IsaSdk exception hierarchy.</summary>
public class IsaException : Exception
{
    /// <summary>Stable machine-readable code; consumers switch on this.</summary>
    public string Code { get; }

    /// <summary>Typed view of <see cref="Code"/>; consumers prefer this for switch statements.</summary>
    public ErrorCode CodeEnum => ErrorCodes.FromWire(Code);

    /// <summary>Engine request id for correlation; may be null when the call never reached the server.</summary>
    public string? RequestId { get; }

    /// <summary>HTTP status code if the error came from a transport response; null otherwise.</summary>
    public int? HttpStatus { get; }

    /// <summary>Construct with code, message, and optional context.</summary>
    public IsaException(string code, string message, string? requestId = null, int? httpStatus = null, Exception? inner = null)
        : base(message, inner)
    {
        Code = code;
        RequestId = requestId;
        HttpStatus = httpStatus;
    }
}

/// <summary>The supplied credentials were rejected.</summary>
public class IsaAuthException : IsaException
{
    /// <inheritdoc cref="IsaException(string,string,string?,int?,Exception?)" />
    public IsaAuthException(string code, string message, string? requestId = null, int? httpStatus = null, Exception? inner = null)
        : base(code, message, requestId, httpStatus, inner)
    {
    }
}

/// <summary>The caller's license is missing, expired, or revoked.</summary>
public class IsaLicenseException : IsaException
{
    /// <inheritdoc cref="IsaException(string,string,string?,int?,Exception?)" />
    public IsaLicenseException(string code, string message, string? requestId = null, int? httpStatus = null, Exception? inner = null)
        : base(code, message, requestId, httpStatus, inner)
    {
    }
}

/// <summary>The caller's request body failed validation.</summary>
public class IsaValidationException : IsaException
{
    /// <summary>JSON-pointer to the failing field; null when not field-specific.</summary>
    public string? Param { get; }

    /// <summary>Construct with the offending field's JSON-pointer.</summary>
    public IsaValidationException(string code, string message, string? param = null, string? requestId = null, int? httpStatus = null, Exception? inner = null)
        : base(code, message, requestId, httpStatus, inner)
    {
        Param = param;
    }
}

/// <summary>The caller exceeded a rate limit. <see cref="RetryAfter"/> tells them when to come back.</summary>
public class IsaRateLimitException : IsaException
{
    /// <summary>Duration the caller should wait before retrying; null if the server did not specify.</summary>
    public TimeSpan? RetryAfter { get; }

    /// <summary>Construct with optional retry-after hint.</summary>
    public IsaRateLimitException(string code, string message, TimeSpan? retryAfter = null, string? requestId = null, int? httpStatus = null, Exception? inner = null)
        : base(code, message, requestId, httpStatus, inner)
    {
        RetryAfter = retryAfter;
    }
}

/// <summary>SDK configuration is invalid — usually a missing required environment variable on a no-arg factory.
/// This error never originates from the server; it is thrown synchronously at construction.</summary>
public class IsaConfigException : IsaException
{
    /// <summary>Construct from a developer-facing message describing what is missing.</summary>
    public IsaConfigException(string message, Exception? inner = null)
        : base("sdk_misconfigured", message, requestId: null, httpStatus: null, inner)
    {
    }
}

/// <summary>The same idempotency key was reused with a different request body (409).
/// Includes the original key and the time the server first saw it so callers can correlate
/// against their write-queue ledger.</summary>
public sealed class IsaIdempotencyConflictException : IsaException
{
    /// <summary>The conflicting idempotency key (echo of <c>X-Isa-Idempotency-Key</c>).</summary>
    public string Key { get; }

    /// <summary>UTC instant the server first saw this key; null if the server did not report it.</summary>
    public DateTimeOffset? FirstSeenAt { get; }

    /// <summary>Construct with the offending key and the first-seen timestamp.</summary>
    public IsaIdempotencyConflictException(
        string key,
        string message,
        DateTimeOffset? firstSeenAt = null,
        string? requestId = null,
        Exception? inner = null)
        : base(ErrorCodes.ToWire(ErrorCode.IdempotencyConflict), message, requestId, httpStatus: 409, inner)
    {
        Key = key;
        FirstSeenAt = firstSeenAt;
    }
}
