/**
 * SDK-wide typed error classes (SDK_DESIGN.md §6).
 *
 * `ZyInsError` (in ./errors) is the legacy Tier 3 base for product-specific
 * errors. This module adds the cross-product `IsaError` hierarchy described
 * in the SDK design: an SDK-base `IsaError`, an `IsaApiError` for any HTTP
 * response carrying a code, and `IsaIdempotencyConflictError` for 409 body
 * mismatches.
 *
 * The two hierarchies coexist during the Tier 3 → unified-SDK migration.
 * New typed errors land here; legacy ones remain in ./errors until the
 * surface is unified in Phase 3.
 */
/** Base error for every SDK failure mode. */
export declare class IsaError extends Error {
    constructor(message: string);
}
/** Configuration error — missing env var, invalid options, etc. */
export declare class IsaConfigError extends IsaError {
    constructor(message: string);
}
/**
 * Any HTTP response that carries a stable error `code`. Subclasses add
 * typed fields (e.g. `IsaIdempotencyConflictError.key`).
 */
export declare class IsaApiError extends IsaError {
    readonly code: string;
    readonly status: number;
    readonly requestId: string | undefined;
    readonly docUrl: string | undefined;
    readonly param: string | undefined;
    readonly adviceCode: string | undefined;
    readonly raw: unknown;
    constructor(opts: {
        message: string;
        code: string;
        status: number;
        requestId?: string;
        docUrl?: string;
        param?: string;
        adviceCode?: string;
        raw?: unknown;
    });
}
/**
 * 409 Conflict surfaced when an idempotency key is reused with a different
 * request body. Server-side, the original response is preserved for the
 * 30-day TTL window; this error tells the caller which key collided and
 * when the original request happened.
 */
export declare class IsaIdempotencyConflictError extends IsaApiError {
    /** The idempotency key that collided. */
    readonly key: string;
    /** RFC 3339 timestamp the original request was first seen. */
    readonly firstSeenAt: string;
    constructor(opts: {
        message: string;
        key: string;
        firstSeenAt: string;
        requestId?: string;
        docUrl?: string;
        raw?: unknown;
    });
}
//# sourceMappingURL=apiError.d.ts.map