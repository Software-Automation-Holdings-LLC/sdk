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
import { type ProblemDetails } from '../core/index.js';
/**
 * Wire-stable error codes mirroring `api.isa.v1.ErrorCode` values in their
 * lowercase snake_case form. Cross-language SDKs share this set.
 */
export type ErrorCode = 'unauthorized' | 'token_expired' | 'invalid_token' | 'forbidden' | 'not_found' | 'method_not_allowed' | 'conflict' | 'validation_error' | 'license_locked' | 'rate_limit_exceeded' | 'rate_limited' | 'internal_error' | 'bad_gateway' | 'gateway_timeout' | 'deadline_exceeded' | 'service_unavailable' | 'not_implemented' | 'unknown';
/** Fields every RapidSignError subclass receives at construction. */
export interface RapidSignErrorInit {
    readonly httpStatus: number;
    readonly requestId: string;
    readonly retryAfterMs?: number;
    readonly param?: string;
    readonly docUrl?: string;
    readonly retryable?: boolean;
    /** Wire code from ProblemDetails when it differs from the subclass default. */
    readonly wireCode?: ErrorCode;
}
/**
 * Abstract base class. Every error thrown by the RapidSign SDK is a subclass.
 * Callers `import { RapidSignError } from '@isa-sdk/rapidsign'` and either:
 *
 *   - `if (err instanceof RapidSignError) ...` for a broad catch
 *   - `if (err instanceof RapidSignError.NotFound) ...` for a specific catch
 *   - `switch (err.code) { case 'conflict': ... }` for exhaustive dispatch
 */
export declare abstract class RapidSignError extends Error {
    /** Stable wire code; consumers switch on this. */
    abstract readonly code: ErrorCode;
    readonly httpStatus: number;
    readonly requestId: string;
    /** Whether a bounded retry has any chance of succeeding. */
    readonly retryable: boolean;
    /** When `retryable === true`, the server-suggested delay. */
    readonly retryAfterMs?: number;
    /** JSON-pointer to the failing field (validation_error only). */
    readonly param?: string;
    /** Link to the docs page explaining this error and remediation. */
    readonly docUrl?: string;
    constructor(message: string, init: RapidSignErrorInit);
}
export declare namespace RapidSignError {
    /** 401 — missing or invalid bearer token. */
    class Unauthorized extends RapidSignError {
        readonly code: "unauthorized";
    }
    /** 401 specifically signalled with TOKEN_EXPIRED — caller should refresh. */
    class TokenExpired extends RapidSignError {
        readonly code: "token_expired";
    }
    /** 401 specifically signalled with INVALID_TOKEN. */
    class InvalidToken extends RapidSignError {
        readonly code: "invalid_token";
    }
    /** 403 — authenticated but lacking the scope for this operation. */
    class Forbidden extends RapidSignError {
        readonly code: "forbidden";
    }
    /** 404 — document or sign id does not exist. */
    class NotFound extends RapidSignError {
        readonly code: "not_found";
    }
    /** 405 — HTTP method not allowed on this path. */
    class MethodNotAllowed extends RapidSignError {
        readonly code: "method_not_allowed";
    }
    /** 409 — state conflict (already signed, already cancelled, etc.). */
    class Conflict extends RapidSignError {
        readonly code: "conflict";
    }
    /** 400 — request body failed schema/domain validation; `param` is set. */
    class ValidationError extends RapidSignError {
        readonly code: "validation_error";
        /** Field path the validator rejected (e.g. `applicant.dob`). */
        readonly field?: string;
        constructor(message: string, init: RapidSignErrorInit);
    }
    /** 423 — license is locked (admin action or too many devices). */
    class LicenseLocked extends RapidSignError {
        readonly code: "license_locked";
    }
    /** 429 — rate limit exceeded. `retryAfterMs` is always set. */
    class RateLimited extends RapidSignError {
        readonly code: ErrorCode;
        constructor(message: string, init: RapidSignErrorInit);
    }
    /** 500 — unhandled server fault. */
    class InternalError extends RapidSignError {
        readonly code: "internal_error";
        constructor(message: string, init: RapidSignErrorInit);
    }
    /** 502 — upstream dependency returned an unusable response. */
    class BadGateway extends RapidSignError {
        readonly code: "bad_gateway";
        constructor(message: string, init: RapidSignErrorInit);
    }
    /** 504 — upstream dependency did not respond. */
    class GatewayTimeout extends RapidSignError {
        readonly code: "gateway_timeout";
        constructor(message: string, init: RapidSignErrorInit);
    }
    /**
     * Client-side deadline — polling or wait budget exhausted without success.
     * Distinct from server `gateway_timeout` (504).
     */
    class DeadlineExceeded extends RapidSignError {
        readonly code: "deadline_exceeded";
    }
    /** 503 — service is intentionally unavailable. */
    class ServiceUnavailable extends RapidSignError {
        readonly code: "service_unavailable";
        constructor(message: string, init: RapidSignErrorInit);
    }
    /**
     * 501 — capability not yet implemented (e.g. `cancel`, webhooks).
     *
     * Today this also funnels client-side stub paths: the SDK surface includes
     * methods whose server endpoints have not landed (per issue #38). Those
     * methods throw `NotImplemented` with a message naming the tracking issue.
     */
    class NotImplemented extends RapidSignError {
        readonly code: "not_implemented";
    }
    /** Fallback for malformed bodies, network anomalies, etc. */
    class Unknown extends RapidSignError {
        readonly code: "unknown";
    }
}
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
export declare function fromHttpResponse(status: number, body: string, headers: Record<string, string>): RapidSignError;
/** Map a parsed ProblemDetails into the right subclass. */
export declare function fromProblemDetails(problem: ProblemDetails, extra: {
    requestId: string;
    retryAfterMs?: number;
}): RapidSignError;
//# sourceMappingURL=errors.d.ts.map