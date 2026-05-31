/**
 * Typed error hierarchy for the Tier 3 RapidSign facade.
 *
 * Callers switch on `error.code` (the wire `ErrorCode` enum, mirrored as
 * lowercase snake_case strings here per ADR-012) — never on HTTP status,
 * never on `instanceof` for any subclass not exported below.
 *
 * The base is abstract so `new RapidSignError(...)` is impossible — every
 * thrown error has a specific subclass with a stable `code`.
 */
import { isProblemDetails } from '../core/index.js';
/**
 * Abstract base class. Every error thrown by the RapidSign SDK is a subclass.
 * Callers `import { RapidSignError } from '@isa-sdk/rapidsign'` and either:
 *
 *   - `if (err instanceof RapidSignError) ...` for a broad catch
 *   - `if (err instanceof RapidSignError.NotFound) ...` for a specific catch
 *   - `switch (err.code) { case 'conflict': ... }` for exhaustive dispatch
 */
export class RapidSignError extends Error {
    httpStatus;
    requestId;
    /** Whether a bounded retry has any chance of succeeding. */
    retryable;
    /** When `retryable === true`, the server-suggested delay. */
    retryAfterMs;
    /** JSON-pointer to the failing field (validation_error only). */
    param;
    /** Link to the docs page explaining this error and remediation. */
    docUrl;
    constructor(message, init) {
        super(message);
        this.name = new.target.name;
        this.httpStatus = init.httpStatus;
        this.requestId = init.requestId;
        this.retryable = init.retryable ?? false;
        if (init.retryAfterMs !== undefined)
            this.retryAfterMs = init.retryAfterMs;
        if (init.param !== undefined)
            this.param = init.param;
        if (init.docUrl !== undefined)
            this.docUrl = init.docUrl;
    }
}
/* eslint-disable @typescript-eslint/no-namespace */
(function (RapidSignError) {
    /** 401 — missing or invalid bearer token. */
    class Unauthorized extends RapidSignError {
        code = 'unauthorized';
    }
    RapidSignError.Unauthorized = Unauthorized;
    /** 401 specifically signalled with TOKEN_EXPIRED — caller should refresh. */
    class TokenExpired extends RapidSignError {
        code = 'token_expired';
    }
    RapidSignError.TokenExpired = TokenExpired;
    /** 401 specifically signalled with INVALID_TOKEN. */
    class InvalidToken extends RapidSignError {
        code = 'invalid_token';
    }
    RapidSignError.InvalidToken = InvalidToken;
    /** 403 — authenticated but lacking the scope for this operation. */
    class Forbidden extends RapidSignError {
        code = 'forbidden';
    }
    RapidSignError.Forbidden = Forbidden;
    /** 404 — document or sign id does not exist. */
    class NotFound extends RapidSignError {
        code = 'not_found';
    }
    RapidSignError.NotFound = NotFound;
    /** 405 — HTTP method not allowed on this path. */
    class MethodNotAllowed extends RapidSignError {
        code = 'method_not_allowed';
    }
    RapidSignError.MethodNotAllowed = MethodNotAllowed;
    /** 409 — state conflict (already signed, already cancelled, etc.). */
    class Conflict extends RapidSignError {
        code = 'conflict';
    }
    RapidSignError.Conflict = Conflict;
    /** 400 — request body failed schema/domain validation; `param` is set. */
    class ValidationError extends RapidSignError {
        code = 'validation_error';
        /** Field path the validator rejected (e.g. `applicant.dob`). */
        field;
        constructor(message, init) {
            super(message, init);
            if (init.param !== undefined)
                this.field = init.param;
        }
    }
    RapidSignError.ValidationError = ValidationError;
    /** 423 — license is locked (admin action or too many devices). */
    class LicenseLocked extends RapidSignError {
        code = 'license_locked';
    }
    RapidSignError.LicenseLocked = LicenseLocked;
    /** 429 — rate limit exceeded. `retryAfterMs` is always set. */
    class RateLimited extends RapidSignError {
        code;
        constructor(message, init) {
            super(message, { ...init, retryable: true });
            this.code = resolveRateLimitCode(init.wireCode);
        }
    }
    RapidSignError.RateLimited = RateLimited;
    /** 500 — unhandled server fault. */
    class InternalError extends RapidSignError {
        code = 'internal_error';
        constructor(message, init) {
            super(message, { ...init, retryable: true });
        }
    }
    RapidSignError.InternalError = InternalError;
    /** 502 — upstream dependency returned an unusable response. */
    class BadGateway extends RapidSignError {
        code = 'bad_gateway';
        constructor(message, init) {
            super(message, { ...init, retryable: true });
        }
    }
    RapidSignError.BadGateway = BadGateway;
    /** 504 — upstream dependency did not respond. */
    class GatewayTimeout extends RapidSignError {
        code = 'gateway_timeout';
        constructor(message, init) {
            super(message, { ...init, retryable: true });
        }
    }
    RapidSignError.GatewayTimeout = GatewayTimeout;
    /**
     * Client-side deadline — polling or wait budget exhausted without success.
     * Distinct from server `gateway_timeout` (504).
     */
    class DeadlineExceeded extends RapidSignError {
        code = 'deadline_exceeded';
    }
    RapidSignError.DeadlineExceeded = DeadlineExceeded;
    /** 503 — service is intentionally unavailable. */
    class ServiceUnavailable extends RapidSignError {
        code = 'service_unavailable';
        constructor(message, init) {
            super(message, { ...init, retryable: true });
        }
    }
    RapidSignError.ServiceUnavailable = ServiceUnavailable;
    /**
     * 501 — capability not yet implemented (e.g. `cancel`, webhooks).
     *
     * Today this also funnels client-side stub paths: the SDK surface includes
     * methods whose server endpoints have not landed (per issue #38). Those
     * methods throw `NotImplemented` with a message naming the tracking issue.
     */
    class NotImplemented extends RapidSignError {
        code = 'not_implemented';
    }
    RapidSignError.NotImplemented = NotImplemented;
    /** Fallback for malformed bodies, network anomalies, etc. */
    class Unknown extends RapidSignError {
        code = 'unknown';
    }
    RapidSignError.Unknown = Unknown;
})(RapidSignError || (RapidSignError = {}));
/* eslint-enable @typescript-eslint/no-namespace */
/**
 * Parse an HTTP response into the appropriate `RapidSignError` subclass.
 *
 * Resolution order:
 *   1. Body is RFC 7807 ProblemDetails → map by `code`.
 *   2. Body is non-JSON or schema-non-conforming → map by HTTP status.
 *   3. Fallback → `Unknown`.
 *
 * The caller always receives a typed error; `null`/`undefined` is never
 * returned for malformed responses.
 */
export function fromHttpResponse(status, body, headers) {
    const requestId = headers['x-request-id'] ?? headers['request-id'] ?? '';
    const retryAfterMs = parseRetryAfter(headers['retry-after']);
    const problem = tryParseProblemDetails(body);
    if (problem !== undefined) {
        return fromProblemDetails(problem, { requestId, retryAfterMs });
    }
    return fromHttpStatus(status, body.trim(), { httpStatus: status, requestId, retryAfterMs });
}
/** Map a parsed ProblemDetails into the right subclass. */
export function fromProblemDetails(problem, extra) {
    const init = {
        httpStatus: problem.status,
        requestId: problem.request_id ?? extra.requestId,
        ...(extra.retryAfterMs !== undefined && { retryAfterMs: extra.retryAfterMs }),
        ...(problem.param !== undefined && { param: problem.param }),
        ...(problem.doc_url !== undefined && { docUrl: problem.doc_url }),
    };
    const message = problem.detail ?? problem.title;
    const Ctor = ERROR_CLASS_BY_CODE[problem.code];
    if (Ctor) {
        const wireCode = problem.code;
        return new Ctor(message, {
            ...init,
            ...(Ctor === RapidSignError.RateLimited && { wireCode }),
        });
    }
    return fromHttpStatus(problem.status, message, init);
}
/**
 * Fallback mapper when the body is not ProblemDetails. Used for legacy
 * servers, gateway responses, and network-edge failures.
 */
function fromHttpStatus(status, body, init) {
    const message = body || `HTTP ${status}`;
    const Ctor = ERROR_CLASS_BY_STATUS[status] ?? RapidSignError.Unknown;
    return new Ctor(message, { ...init, httpStatus: status });
}
const ERROR_CLASS_BY_CODE = {
    unauthorized: RapidSignError.Unauthorized,
    token_expired: RapidSignError.TokenExpired,
    invalid_token: RapidSignError.InvalidToken,
    forbidden: RapidSignError.Forbidden,
    not_found: RapidSignError.NotFound,
    method_not_allowed: RapidSignError.MethodNotAllowed,
    conflict: RapidSignError.Conflict,
    validation_error: RapidSignError.ValidationError,
    license_locked: RapidSignError.LicenseLocked,
    rate_limit_exceeded: RapidSignError.RateLimited,
    rate_limited: RapidSignError.RateLimited,
    internal_error: RapidSignError.InternalError,
    bad_gateway: RapidSignError.BadGateway,
    gateway_timeout: RapidSignError.GatewayTimeout,
    service_unavailable: RapidSignError.ServiceUnavailable,
    not_implemented: RapidSignError.NotImplemented,
};
const ERROR_CLASS_BY_STATUS = {
    400: RapidSignError.ValidationError,
    401: RapidSignError.Unauthorized,
    403: RapidSignError.Forbidden,
    404: RapidSignError.NotFound,
    405: RapidSignError.MethodNotAllowed,
    409: RapidSignError.Conflict,
    423: RapidSignError.LicenseLocked,
    429: RapidSignError.RateLimited,
    500: RapidSignError.InternalError,
    501: RapidSignError.NotImplemented,
    502: RapidSignError.BadGateway,
    503: RapidSignError.ServiceUnavailable,
    504: RapidSignError.GatewayTimeout,
};
/** Best-effort ProblemDetails parse; returns `undefined` for non-JSON bodies. */
function tryParseProblemDetails(body) {
    const trimmed = body.trim();
    if (!trimmed.startsWith('{'))
        return undefined;
    try {
        const parsed = JSON.parse(trimmed);
        if (isProblemDetails(parsed))
            return parsed;
        // Some servers emit valid problem+json with `code` values outside the
        // strict @isa-sdk/core whitelist. Accept any object carrying the RFC
        // 7807 required fields.
        if (looksLikeProblemDetails(parsed))
            return parsed;
        return undefined;
    }
    catch {
        return undefined;
    }
}
function looksLikeProblemDetails(v) {
    if (v === null || typeof v !== 'object')
        return false;
    const o = v;
    return (typeof o.title === 'string' &&
        typeof o.status === 'number' &&
        Number.isInteger(o.status) &&
        o.status >= 100 &&
        o.status <= 599 &&
        typeof o.code === 'string');
}
const RETRY_AFTER_SECONDS_MAX = 86_400;
const RETRY_AFTER_MS_MAX = RETRY_AFTER_SECONDS_MAX * 1_000;
function parseRetryAfter(value) {
    if (!value)
        return undefined;
    const trimmed = value.trim();
    if (/^\d+$/.test(trimmed)) {
        const seconds = Number.parseInt(trimmed, 10);
        if (seconds >= 0 && seconds <= RETRY_AFTER_SECONDS_MAX) {
            return seconds * 1_000;
        }
        return undefined;
    }
    const asDate = Date.parse(trimmed);
    if (Number.isFinite(asDate)) {
        const delta = asDate - Date.now();
        if (delta <= 0)
            return 0;
        return Math.min(delta, RETRY_AFTER_MS_MAX);
    }
    return undefined;
}
function resolveRateLimitCode(wireCode) {
    if (wireCode === 'rate_limited' || wireCode === 'rate_limit_exceeded') {
        return wireCode;
    }
    return 'rate_limit_exceeded';
}
//# sourceMappingURL=errors.js.map