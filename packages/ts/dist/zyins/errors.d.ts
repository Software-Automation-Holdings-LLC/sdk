/**
 * Tier 3 typed error funnel.
 *
 * The ZyINS API speaks two error dialects in flight today:
 *
 * 1. Modern ProblemDetails (RFC 7807) — the future. Returned by the new
 *    Connect-RPC v1 endpoints.
 * 2. Legacy ERR_* magic strings — returned by the licensing CGI as raw
 *    text/plain. bpp2.0's `useSoftwareActivator.js` today switches on each
 *    string with a 7-branch if-chain.
 *
 * Tier 3 absorbs both into one typed funnel: `fromHttpResponse` parses the
 * status + body and returns a `ZyInsError` subclass. The caller switches on
 * `error.code` — never on HTTP status, never on message text. This is the
 * "legacy error formats are absorbed" invariant from ADR-035.
 */
import { type ProblemDetails } from '../core';
/**
 * License-specific error codes. Drawn from the legacy CGI's ERR_* set;
 * additions ship with API minor versions. The string values are stable
 * across SDK releases (consumers switch on them).
 */
export type LicenseErrorCode = 'max_activations' | 'inactive' | 'active_elsewhere' | 'locked' | 'invalid_credentials' | 'no_email' | 'unknown';
/**
 * Prequalify-specific error codes. The validation_error case carries a
 * `param` field naming which input failed.
 */
export type PrequalifyErrorCode = 'validation_error' | 'engine_error' | 'unknown';
/**
 * Base class for every error the Tier 3 facade emits. Mirrors the
 * ProblemDetails shape so callers get the same field set whether the
 * underlying response was JSON or a legacy ERR_* string.
 */
export declare class ZyInsError extends Error {
    readonly code: string;
    readonly httpStatus?: number;
    readonly requestId?: string;
    readonly adviceCode?: string;
    readonly docUrl?: string;
    readonly param?: string;
    constructor(message: string, opts: {
        code: string;
        httpStatus?: number;
        requestId?: string;
        adviceCode?: string;
        docUrl?: string;
        param?: string;
    });
}
/** License activation / deactivation errors. */
export declare class LicenseError extends ZyInsError {
    readonly code: LicenseErrorCode;
    constructor(code: LicenseErrorCode, message: string, httpStatus?: number);
}
/** Prequalify validation / engine errors. */
export declare class PrequalifyError extends ZyInsError {
    readonly code: PrequalifyErrorCode;
    constructor(code: PrequalifyErrorCode, message: string, opts?: {
        httpStatus?: number;
        param?: string;
    });
}
/** 429 with optional Retry-After hint. */
export declare class RateLimitedError extends ZyInsError {
    /** Seconds the caller should wait before retrying, when known. */
    readonly retryAfterSeconds?: number;
    constructor(message: string, opts?: {
        code?: 'rate_limit_exceeded' | 'rate_limited';
        httpStatus: number;
        retryAfterSeconds?: number;
    });
}
/**
 * Parse a raw HTTP response (status + body) into a typed `ZyInsError`.
 *
 * Resolution order:
 * 1. Body is a ProblemDetails JSON → map by `code`.
 * 2. Body is a legacy ERR_* string → map by token table.
 * 3. Body is `NO_EMAIL` (the licensing CGI's special case) → LicenseError.
 * 4. Fallback → `ZyInsError` with code `unknown`.
 *
 * The caller always gets a typed value; `null` or `undefined` is never
 * returned even for malformed responses. This is the absorption boundary.
 */
export declare function fromHttpResponse(status: number, body: string): ZyInsError;
/** Map a parsed ProblemDetails into the right Tier 3 subclass. */
export declare function fromProblemDetails(problem: ProblemDetails): ZyInsError;
//# sourceMappingURL=errors.d.ts.map