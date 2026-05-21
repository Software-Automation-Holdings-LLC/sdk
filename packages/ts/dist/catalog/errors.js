/**
 * Generated catalog module — do not hand-edit; rerun the generator.
 *
 * Produced by `packages/ts/scripts/gen-catalog.mjs`.
 * Regenerate with `npm run gen:catalog` (runs automatically before `build`).
 *
 * Source data:
 *   - isa-platform/shared/schemas/api/isa/v1/common.proto
 */
/**
 * Stable wire-form error codes. Mirrors `api.isa.v1.ErrorCode`. Consumers
 * MUST switch on these values rather than HTTP status or message text.
 *
 * This enum extends the legacy `ErrorCode` type alias exported from
 * `./rapidsign/errors` — the string values match exactly, so callers
 * passing a wire-form string to either surface compile cleanly.
 */
export var ErrorCode;
(function (ErrorCode) {
    /** Operation exceeded its deadline before completing. */
    ErrorCode["DeadlineExceeded"] = "deadline_exceeded";
    /** Legacy RapidSign rate limit code. Retry after the server-provided delay. */
    ErrorCode["RateLimited"] = "rate_limited";
    /** Unrecognized error code preserved for forward compatibility. */
    ErrorCode["Unknown"] = "unknown";
})(ErrorCode || (ErrorCode = {}));
/**
 * Machine-readable next-action identifiers. Keys are wire-form error codes;
 * values are stable identifiers a programmatic consumer can switch on to
 * choose a retry / refresh / surface-to-user strategy.
 */
export const ErrorAdviceCodes = Object.freeze({
    'deadline_exceeded': 'retry_with_backoff',
    'rate_limited': 'wait_and_retry',
    'unknown': 'see_docs',
});
/** Doc URL per error code. Every value resolves to a live remediation page. */
export const ErrorDocUrls = Object.freeze({
    'deadline_exceeded': 'https://docs.isaapi.com/errors/deadline_exceeded',
    'rate_limited': 'https://docs.isaapi.com/errors/rate_limited',
    'unknown': 'https://docs.isaapi.com/errors/unknown',
});
//# sourceMappingURL=errors.js.map