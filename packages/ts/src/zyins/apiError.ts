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
  constructor(message: string) {
    super(message);
    this.name = 'IsaError';
  }
}

/** Configuration error — missing env var, invalid options, etc. */
export class IsaConfigError extends IsaError {
  constructor(message: string) {
    super(message);
    this.name = 'IsaConfigError';
  }
}

/**
 * Any HTTP response that carries a stable error `code`. Subclasses add
 * typed fields (e.g. `IsaIdempotencyConflictError.key`).
 */
export class IsaApiError extends IsaError {
  public readonly code: string;
  public readonly status: number;
  public readonly requestId: string | undefined;
  public readonly docUrl: string | undefined;
  public readonly param: string | undefined;
  public readonly adviceCode: string | undefined;
  public readonly raw: unknown;

  constructor(opts: {
    message: string;
    code: string;
    status: number;
    requestId?: string;
    docUrl?: string;
    param?: string;
    adviceCode?: string;
    raw?: unknown;
  }) {
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
 * 409 Conflict surfaced when an idempotency key is reused with a different
 * request body. Server-side, the original response is preserved for the
 * 30-day TTL window; this error tells the caller which key collided and
 * when the original request happened.
 */
export class IsaIdempotencyConflictError extends IsaApiError {
  /** The idempotency key that collided. */
  public readonly key: string;
  /** RFC 3339 timestamp the original request was first seen. */
  public readonly firstSeenAt: string;

  constructor(opts: {
    message: string;
    key: string;
    firstSeenAt: string;
    requestId?: string;
    docUrl?: string;
    raw?: unknown;
  }) {
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
