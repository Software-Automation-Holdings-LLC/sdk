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
export class IsaError extends Error {
    constructor(message) {
        super(message);
        this.name = 'IsaError';
    }
}
/** Configuration error — missing env var, invalid options, etc. */
export class IsaConfigError extends IsaError {
    constructor(message) {
        super(message);
        this.name = 'IsaConfigError';
    }
}
/**
 * The `isa.zyins.*` product surface was invoked on a license-mode `Isa`
 * that has no usable licenseKey. Consumers dispatch on `error.code` rather
 * than substring-matching the message — the message text is allowed to
 * evolve, but `code` is contractual.
 */
export class IsaNotActivatedError extends IsaError {
    code;
    constructor(code = 'requires_activation', message) {
        super(message ??
            'isa.zyins.* product methods require an active license. Call isa.zyins.license.activate() first.');
        this.name = 'IsaNotActivatedError';
        this.code = code;
    }
}
/**
 * Any HTTP response that carries a stable error `code`. Subclasses add
 * typed fields (e.g. `IsaIdempotencyConflictError.key`).
 */
export class IsaApiError extends IsaError {
    code;
    status;
    requestId;
    docUrl;
    param;
    adviceCode;
    raw;
    constructor(opts) {
        super(opts.message);
        this.name = 'IsaApiError';
        this.code = opts.code;
        this.status = opts.status;
        this.requestId = opts.requestId;
        this.docUrl = opts.docUrl;
        this.param = opts.param;
        this.adviceCode = opts.adviceCode;
        this.raw = opts.raw;
    }
}
/**
 * 401 Unauthorized — the request was rejected by session-auth
 * verification (missing/expired session, bad signature, etc.). Maps to
 * the `unauthorized` problem-details code in the platform catalog.
 */
export class IsaUnauthorizedError extends IsaApiError {
    constructor(opts) {
        super({
            message: opts.message,
            code: opts.code ?? 'unauthorized',
            status: 401,
            ...(opts.requestId !== undefined && { requestId: opts.requestId }),
            ...(opts.raw !== undefined && { raw: opts.raw }),
        });
        this.name = 'IsaUnauthorizedError';
    }
}
/**
 * 400 Validation — the request body or arguments were malformed. Maps to
 * the `validation_error` problem-details code.
 */
export class IsaValidationError extends IsaApiError {
    constructor(opts) {
        super({
            message: opts.message,
            code: opts.code ?? 'validation_error',
            status: 400,
            ...(opts.param !== undefined && { param: opts.param }),
            ...(opts.requestId !== undefined && { requestId: opts.requestId }),
            ...(opts.raw !== undefined && { raw: opts.raw }),
        });
        this.name = 'IsaValidationError';
    }
}
/**
 * 409 Conflict surfaced when an idempotency key is reused with a different
 * request body. Server-side, the original response is preserved for the
 * 30-day TTL window; this error tells the caller which key collided and
 * when the original request happened.
 */
export class IsaIdempotencyConflictError extends IsaApiError {
    /** The idempotency key that collided. */
    key;
    /** RFC 3339 timestamp the original request was first seen. */
    firstSeenAt;
    constructor(opts) {
        super({
            message: opts.message,
            code: 'idempotency_conflict',
            status: 409,
            ...(opts.requestId !== undefined && { requestId: opts.requestId }),
            ...(opts.docUrl !== undefined && { docUrl: opts.docUrl }),
            ...(opts.raw !== undefined && { raw: opts.raw }),
        });
        this.name = 'IsaIdempotencyConflictError';
        this.key = opts.key;
        this.firstSeenAt = opts.firstSeenAt;
    }
}
//# sourceMappingURL=apiError.js.map