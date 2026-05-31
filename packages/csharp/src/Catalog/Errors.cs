// CATALOG-GEN: do not hand-edit; rerun packages/csharp/scripts/gen-catalog.mjs.
//
// Source data:
//   - isa-platform/shared/schemas/api/isa/v1/common.proto

using System.Collections.Generic;
using System.Collections.ObjectModel;

namespace Isa.Sdk.Catalog;

/// <summary>Stable wire-form error codes mirroring <c>api.isa.v1.ErrorCode</c>.
/// Named <c>CatalogErrorCode</c> to avoid clashing with the legacy
/// <see cref="global::Isa.Sdk.Core.ErrorCode"/> already shipped at v0.3.x.</summary>
public enum CatalogErrorCode
{
    /// <summary>Upstream dependency returned an unusable response.</summary>
    [WireValue("bad_gateway")] BadGateway,
    /// <summary>State conflict (e.g. already activated, already revoked, document already signed).</summary>
    [WireValue("conflict")] Conflict,
    /// <summary>Authenticated but lacking scope for this operation.</summary>
    [WireValue("forbidden")] Forbidden,
    /// <summary>Upstream dependency did not respond within the budget.</summary>
    [WireValue("gateway_timeout")] GatewayTimeout,
    /// <summary>Unhandled server fault. Request ID identifies the log entry.</summary>
    [WireValue("internal_error")] InternalError,
    /// <summary>Bearer token or license signature does not validate.</summary>
    [WireValue("invalid_token")] InvalidToken,
    /// <summary>License is locked (too many device registrations or admin action).</summary>
    [WireValue("license_locked")] LicenseLocked,
    /// <summary>HTTP method not allowed on this path.</summary>
    [WireValue("method_not_allowed")] MethodNotAllowed,
    /// <summary>Resource does not exist or is not visible to the caller.</summary>
    [WireValue("not_found")] NotFound,
    /// <summary>Capability not yet implemented (e.g. PDF renderer not configured).</summary>
    [WireValue("not_implemented")] NotImplemented,
    /// <summary>Rate limit exceeded. `Retry-After` header is set.</summary>
    [WireValue("rate_limit_exceeded")] RateLimitExceeded,
    /// <summary>Service is intentionally unavailable (draining, maintenance).</summary>
    [WireValue("service_unavailable")] ServiceUnavailable,
    /// <summary>Bearer token or license has expired. Client should refresh.</summary>
    [WireValue("token_expired")] TokenExpired,
    /// <summary>Authentication required or credentials invalid.</summary>
    [WireValue("unauthorized")] Unauthorized,
    /// <summary>Request body failed schema or domain validation. `param` is set.</summary>
    [WireValue("validation_error")] ValidationError,
}

/// <summary>Machine-readable next-action identifiers per wire-form error code.</summary>
public static class ErrorAdviceCodes
{
    private static readonly IReadOnlyDictionary<CatalogErrorCode, string> MAP = new ReadOnlyDictionary<CatalogErrorCode, string>(new Dictionary<CatalogErrorCode, string>
    {
        [CatalogErrorCode.BadGateway] = "retry_with_backoff",
        [CatalogErrorCode.Conflict] = "reconcile_state",
        [CatalogErrorCode.Forbidden] = "check_scopes",
        [CatalogErrorCode.GatewayTimeout] = "retry_with_backoff",
        [CatalogErrorCode.InternalError] = "retry_or_contact_support",
        [CatalogErrorCode.InvalidToken] = "reissue_session",
        [CatalogErrorCode.LicenseLocked] = "contact_support",
        [CatalogErrorCode.MethodNotAllowed] = "check_http_method",
        [CatalogErrorCode.NotFound] = "verify_resource_id",
        [CatalogErrorCode.NotImplemented] = "check_feature_availability",
        [CatalogErrorCode.RateLimitExceeded] = "wait_and_retry",
        [CatalogErrorCode.ServiceUnavailable] = "retry_with_backoff",
        [CatalogErrorCode.TokenExpired] = "refresh_session",
        [CatalogErrorCode.Unauthorized] = "authenticate_caller",
        [CatalogErrorCode.ValidationError] = "fix_request_body",
    });

    /// <summary>Get the advice identifier for an error code.</summary>
    public static string Get(CatalogErrorCode code) => MAP.TryGetValue(code, out var v) ? v : "see_docs";
}

/// <summary>Doc URL per error code.</summary>
public static class ErrorDocUrls
{
    private static readonly IReadOnlyDictionary<CatalogErrorCode, string> MAP = new ReadOnlyDictionary<CatalogErrorCode, string>(new Dictionary<CatalogErrorCode, string>
    {
        [CatalogErrorCode.BadGateway] = "https://docs.isaapi.com/errors/bad_gateway",
        [CatalogErrorCode.Conflict] = "https://docs.isaapi.com/errors/conflict",
        [CatalogErrorCode.Forbidden] = "https://docs.isaapi.com/errors/forbidden",
        [CatalogErrorCode.GatewayTimeout] = "https://docs.isaapi.com/errors/gateway_timeout",
        [CatalogErrorCode.InternalError] = "https://docs.isaapi.com/errors/internal_error",
        [CatalogErrorCode.InvalidToken] = "https://docs.isaapi.com/errors/invalid_token",
        [CatalogErrorCode.LicenseLocked] = "https://docs.isaapi.com/errors/license_locked",
        [CatalogErrorCode.MethodNotAllowed] = "https://docs.isaapi.com/errors/method_not_allowed",
        [CatalogErrorCode.NotFound] = "https://docs.isaapi.com/errors/not_found",
        [CatalogErrorCode.NotImplemented] = "https://docs.isaapi.com/errors/not_implemented",
        [CatalogErrorCode.RateLimitExceeded] = "https://docs.isaapi.com/errors/rate_limit_exceeded",
        [CatalogErrorCode.ServiceUnavailable] = "https://docs.isaapi.com/errors/service_unavailable",
        [CatalogErrorCode.TokenExpired] = "https://docs.isaapi.com/errors/token_expired",
        [CatalogErrorCode.Unauthorized] = "https://docs.isaapi.com/errors/unauthorized",
        [CatalogErrorCode.ValidationError] = "https://docs.isaapi.com/errors/validation_error",
    });

    /// <summary>Get the documentation URL for an error code.</summary>
    public static string Get(CatalogErrorCode code) => MAP.TryGetValue(code, out var v) ? v : "https://docs.isaapi.com/errors";
}
