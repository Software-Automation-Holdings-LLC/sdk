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
 * Stable activation-state codes surfaced by {@link IsaNotActivatedError}.
 *
 * Today only `requires_activation` is thrown by the SDK; future codes
 * (`max_activations`, `inactive`, `active_elsewhere`, `locked`) will flow
 * from the server's `licenses.activate` response once typed activation
 * errors land (tracked as task #197).
 */
export type IsaNotActivatedCode = 'requires_activation' | 'max_activations' | 'inactive' | 'active_elsewhere' | 'locked';
/**
 * The `isa.zyins.*` product surface was invoked on a license-mode `Isa`
 * that has no usable licenseKey. Consumers dispatch on `error.code` rather
 * than substring-matching the message — the message text is allowed to
 * evolve, but `code` is contractual.
 */
export declare class IsaNotActivatedError extends IsaError {
    readonly code: IsaNotActivatedCode;
    constructor(code?: IsaNotActivatedCode, message?: string);
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
 * 401 Unauthorized — the request was rejected by session-auth
 * verification (missing/expired session, bad signature, etc.). Maps to
 * the `unauthorized` problem-details code in the platform catalog.
 */
export declare class IsaUnauthorizedError extends IsaApiError {
    constructor(opts: {
        message: string;
        code?: string;
        requestId?: string;
        raw?: unknown;
    });
}
/**
 * 400 Validation — the request body or arguments were malformed. Maps to
 * the `validation_error` problem-details code.
 */
export declare class IsaValidationError extends IsaApiError {
    constructor(opts: {
        message: string;
        code?: string;
        param?: string;
        requestId?: string;
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