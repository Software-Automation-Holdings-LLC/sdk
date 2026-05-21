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
export declare enum ErrorCode {
    /** Operation exceeded its deadline before completing. */
    DeadlineExceeded = "deadline_exceeded",
    /** Legacy RapidSign rate limit code. Retry after the server-provided delay. */
    RateLimited = "rate_limited",
    /** Unrecognized error code preserved for forward compatibility. */
    Unknown = "unknown"
}
/**
 * Machine-readable next-action identifiers. Keys are wire-form error codes;
 * values are stable identifiers a programmatic consumer can switch on to
 * choose a retry / refresh / surface-to-user strategy.
 */
export declare const ErrorAdviceCodes: Readonly<Record<ErrorCode, string>>;
/** Doc URL per error code. Every value resolves to a live remediation page. */
export declare const ErrorDocUrls: Readonly<Record<ErrorCode, string>>;
//# sourceMappingURL=errors.d.ts.map