<?php

declare(strict_types=1);

namespace Sah\Sdk\Catalog;

/**
 * Generated catalog module — do not hand-edit; rerun the generator.
 *
 * Source data:
 *   - isa-platform/shared/schemas/api/isa/v1/common.proto
 *
 * Stable wire-form error codes. Mirrors `api.isa.v1.ErrorCode`.
 * Consumers MUST switch on these values rather than HTTP status or
 * message text.
 *
 * These are public error identifiers, not credentials — they appear
 * verbatim in error responses and integrator-facing documentation.
 */
enum ErrorCode: string
{
    /** Upstream dependency returned an unusable response. */
    case BadGateway = 'bad_gateway';
    /** State conflict (already activated, already revoked, document already signed, …). */
    case Conflict = 'conflict';
    /** Authenticated but lacking scope for this operation. */
    case Forbidden = 'forbidden';
    /** Upstream dependency did not respond within the budget. */
    case GatewayTimeout = 'gateway_timeout';
    /** Unhandled server fault. Request ID identifies the log entry. */
    case InternalError = 'internal_error';
    /** Bearer or license auth header does not validate. */
    case InvalidAuth = 'invalid_token';
    /** License is locked (too many device registrations or admin action). */
    case LicenseLocked = 'license_locked';
    /** HTTP method not allowed on this path. */
    case MethodNotAllowed = 'method_not_allowed';
    /** Resource does not exist or is not visible to the caller. */
    case NotFound = 'not_found';
    /** Capability not yet implemented (e.g. PDF renderer not configured). */
    case NotImplemented = 'not_implemented';
    /** Rate limit exceeded. `Retry-After` header is set. */
    case RateLimitExceeded = 'rate_limit_exceeded';
    /** Service is intentionally unavailable (draining, maintenance). */
    case ServiceUnavailable = 'service_unavailable';
    /** Bearer or license auth header has expired. Client should refresh. */
    case AuthExpired = 'token_expired';
    /** Authentication required or credentials invalid. */
    case Unauthorized = 'unauthorized';
    /** Request body failed schema or domain validation. `param` is set. */
    case ValidationError = 'validation_error';
}
