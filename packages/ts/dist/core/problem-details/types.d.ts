/**
 * RFC 7807 Problem Details types shared with platform-php's ProblemException.
 *
 * Error codes are drawn from ADR-012 (the platform-wide error taxonomy). The
 * list below is the v1 set; revisions MUST update both this file and the PHP
 * ProblemException enum in the same commit to preserve type parity.
 */
/**
 * The authoritative list of platform error codes. Revisions MUST update both
 * this array and `platform-php`'s `ProblemException` enum in the same commit.
 */
export declare const PROBLEM_DETAILS_CODES: readonly ["unauthorized", "token_expired", "validation_error", "license_locked", "not_found", "forbidden", "conflict", "rate_limited", "internal_error", "service_unavailable", "idempotency_conflict"];
export type ProblemDetailsCode = (typeof PROBLEM_DETAILS_CODES)[number];
export interface ProblemDetails {
    /** URI reference identifying the problem type. */
    type: string;
    /** Short, human-readable summary. */
    title: string;
    /** HTTP status code emitted by the origin server. */
    status: number;
    /** Machine-readable error code (stable; consumers switch on this). */
    code: ProblemDetailsCode;
    /** Human-readable explanation specific to this occurrence. */
    detail?: string;
    /** URI reference identifying the specific occurrence. */
    instance?: string;
    /** Name of the request parameter that failed validation. */
    param?: string;
    /** Link to public documentation for this error code. */
    doc_url?: string;
}
/** Type guard — narrow `unknown` to ProblemDetails. */
export declare function isProblemDetails(value: unknown): value is ProblemDetails;
//# sourceMappingURL=types.d.ts.map