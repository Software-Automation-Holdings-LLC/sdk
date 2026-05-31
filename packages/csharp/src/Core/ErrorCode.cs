// Stable machine-readable error codes the API emits. Consumers switch
// on these values; the underlying string is the over-the-wire form.
// New codes are added (never renamed) and ship alongside a doc page
// per the api-standards.md doc-url discipline.
namespace Isa.Sdk.Core;

/// <summary>Stable error code enum mirrored across every IsaSdk language binding.
/// Values map 1:1 to the <c>code</c> field of the RFC 7807 error body.</summary>
public enum ErrorCode
{
    /// <summary>Unknown code; the server returned a value the SDK does not recognize yet.</summary>
    Unknown,

    /// <summary>Caller's request body failed validation (400/422).</summary>
    ValidationError,

    /// <summary>Caller is not authenticated (401).</summary>
    Unauthorized,

    /// <summary>Caller is authenticated but lacks the required scope (403).</summary>
    Forbidden,

    /// <summary>Caller's license is missing, expired, or revoked (403).</summary>
    LicenseExpired,

    /// <summary>Caller's session has expired (401).</summary>
    SessionExpired,

    /// <summary>Resource was not found (404).</summary>
    NotFound,

    /// <summary>Resource conflict (409).</summary>
    Conflict,

    /// <summary>Same <c>X-Isa-Idempotency-Key</c> reused with a different body (409).</summary>
    IdempotencyConflict,

    /// <summary>Caller exceeded a rate limit (429).</summary>
    RateLimited,

    /// <summary>Server-side error (5xx).</summary>
    InternalError,
}

/// <summary>String⇄enum mapping for <see cref="ErrorCode"/>. Keeps the wire form in one place.</summary>
public static class ErrorCodes
{
    private const string ValidationErrorWire = "validation_error";
    private const string UnauthorizedWire = "unauthorized";
    private const string ForbiddenWire = "forbidden";
    private const string LicenseExpiredWire = "license_expired";
    private const string SessionExpiredWire = "session_expired";
    private const string NotFoundWire = "not_found";
    private const string ConflictWire = "conflict";
    private const string IdempotencyConflictWire = "idempotency_conflict";
    private const string RateLimitExceededWire = "rate_limit_exceeded";
    private const string LegacyRateLimitedWire = "rate_limited";
    private const string InternalErrorWire = "internal_error";

    /// <summary>Parse the wire form into the enum; unknown values map to <see cref="ErrorCode.Unknown"/>.</summary>
    public static ErrorCode FromWire(string? wire) => wire switch
    {
        ValidationErrorWire => ErrorCode.ValidationError,
        UnauthorizedWire => ErrorCode.Unauthorized,
        ForbiddenWire => ErrorCode.Forbidden,
        LicenseExpiredWire => ErrorCode.LicenseExpired,
        "license_revoked" => ErrorCode.LicenseExpired,
        SessionExpiredWire => ErrorCode.SessionExpired,
        NotFoundWire => ErrorCode.NotFound,
        ConflictWire => ErrorCode.Conflict,
        IdempotencyConflictWire => ErrorCode.IdempotencyConflict,
        RateLimitExceededWire or LegacyRateLimitedWire => ErrorCode.RateLimited,
        InternalErrorWire => ErrorCode.InternalError,
        _ => ErrorCode.Unknown,
    };

    /// <summary>Render the enum back to its wire form.</summary>
    public static string ToWire(ErrorCode code) => code switch
    {
        ErrorCode.ValidationError => ValidationErrorWire,
        ErrorCode.Unauthorized => UnauthorizedWire,
        ErrorCode.Forbidden => ForbiddenWire,
        ErrorCode.LicenseExpired => LicenseExpiredWire,
        ErrorCode.SessionExpired => SessionExpiredWire,
        ErrorCode.NotFound => NotFoundWire,
        ErrorCode.Conflict => ConflictWire,
        ErrorCode.IdempotencyConflict => IdempotencyConflictWire,
        ErrorCode.RateLimited => RateLimitExceededWire,
        ErrorCode.InternalError => InternalErrorWire,
        _ => "unknown",
    };
}
