/**
 * RFC 7807 Problem Details types.
 *
 * Error codes are drawn from ADR-012 (the platform-wide error taxonomy). The
 * list below is the v1 set.
 */
/**
 * The authoritative list of platform error codes.
 */
export const PROBLEM_DETAILS_CODES = [
    "unauthorized",
    "token_expired",
    "validation_error",
    "license_locked",
    "not_found",
    "forbidden",
    "conflict",
    "rate_limit_exceeded",
    "rate_limited",
    "internal_error",
    "service_unavailable",
    "idempotency_conflict",
];
const PROBLEM_DETAILS_CODE_SET = new Set(PROBLEM_DETAILS_CODES);
/** Type guard — narrow `unknown` to ProblemDetails. */
export function isProblemDetails(value) {
    if (value === null || typeof value !== "object")
        return false;
    const v = value;
    return (typeof v.type === "string"
        && typeof v.title === "string"
        && isHttpStatus(v.status)
        && typeof v.code === "string"
        && PROBLEM_DETAILS_CODE_SET.has(v.code));
}
/** RFC 9110 status codes are integers in [100, 599]. */
function isHttpStatus(value) {
    return typeof value === "number" && Number.isInteger(value) && value >= 100 && value <= 599;
}
//# sourceMappingURL=types.js.map