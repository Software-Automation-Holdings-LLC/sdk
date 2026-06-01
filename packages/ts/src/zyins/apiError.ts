/**
 * SDK-wide typed error classes (SDK_DESIGN.md §6).
 *
 * Every error the SDK throws descends from one base, `IsaError`. The product
 * (ZyINS, RapidSign, …) is carried as the `code` field, never as a parallel
 * class tree — so a consumer catches `IsaError` once and dispatches on `code`,
 * exactly like Stripe's `StripeError`/`code` or AWS's `ServiceException`/`code`.
 *
 * `IsaApiError` covers any HTTP response carrying a stable `code`; the typed
 * subclasses below add status-specific fields (`IsaLicenseError.code`,
 * `IsaRateLimitError.retryAfterSeconds`, `IsaIdempotencyConflictError.key`).
 * The error funnel in `./errors` (`fromHttpResponse`/`fromProblemDetails`)
 * resolves a raw response into the right subclass.
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

/** Runtime timeout error for external work exceeding the configured deadline. */
export class IsaTimeoutError extends IsaError {
  constructor(message: string) {
    super(message);
    this.name = 'IsaTimeoutError';
  }
}

/**
 * A shared case could not be opened because it is absent or expired. The
 * zero-knowledge store returns 404 for both cases by design — TTL expiry and
 * a never-existing id are deliberately indistinguishable — so a single typed
 * error covers both. The message and fields are key-free: the share link and
 * its fragment never reach this error (see the no-leak rule in cases.ts).
 */
export class IsaCaseExpiredError extends IsaError {
  /** The case id that could not be resolved; never the fragment key. */
  public readonly caseId: string;

  constructor(caseId: string) {
    super(`case ${caseId} is unavailable (expired or never existed)`);
    this.name = 'IsaCaseExpiredError';
    this.caseId = caseId;
  }
}

/**
 * Stable activation-state codes surfaced by {@link IsaNotActivatedError}.
 *
 * Today only `requires_activation` is thrown by the SDK; future codes
 * (`max_activations`, `inactive`, `active_elsewhere`, `locked`) will flow
 * from the server's `licenses.activate` response once typed activation
 * errors land (tracked as task #197).
 */
export type IsaNotActivatedCode =
  | 'requires_activation'
  | 'max_activations'
  | 'inactive'
  | 'active_elsewhere'
  | 'locked';

/**
 * The `isa.zyins.*` product surface was invoked on a license-mode `Isa`
 * that has no usable licenseKey. Consumers dispatch on `error.code` rather
 * than substring-matching the message — the message text is allowed to
 * evolve, but `code` is contractual.
 */
export class IsaNotActivatedError extends IsaError {
  public readonly code: IsaNotActivatedCode;

  constructor(code: IsaNotActivatedCode = 'requires_activation', message?: string) {
    super(
      message ??
        'isa.zyins.* product methods require an active license. Call isa.zyins.license.activate() first.',
    );
    this.name = 'IsaNotActivatedError';
    this.code = code;
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
 * 401 Unauthorized — the request was rejected by session-auth
 * verification (missing/expired session, bad signature, etc.). Maps to
 * the `unauthorized` problem-details code in the platform catalog.
 */
export class IsaUnauthorizedError extends IsaApiError {
  constructor(opts: {
    message: string;
    code?: string;
    requestId?: string;
    raw?: unknown;
  }) {
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
  constructor(opts: {
    message: string;
    code?: string;
    param?: string;
    requestId?: string;
    raw?: unknown;
  }) {
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

/**
 * Stable license-state codes surfaced by {@link IsaLicenseError}. Drawn from
 * the licensing server's `ERR_*` set; the string values never change across
 * SDK releases, so consumers switch on `error.code` rather than the message.
 */
export type IsaLicenseErrorCode =
  | 'max_activations'
  | 'inactive'
  | 'active_elsewhere'
  | 'locked'
  | 'invalid_credentials'
  | 'no_email'
  | 'unknown';

/**
 * License activation / deactivation failure (the licensing server's `ERR_*`
 * responses, absorbed into the typed funnel). `code` is the contract;
 * `httpStatus` reflects the originating response when one was present.
 */
export class IsaLicenseError extends IsaApiError {
  public override readonly code: IsaLicenseErrorCode;

  constructor(code: IsaLicenseErrorCode, message: string, opts: { status?: number; requestId?: string; raw?: unknown } = {}) {
    super({
      message,
      code,
      status: opts.status ?? 0,
      ...(opts.requestId !== undefined && { requestId: opts.requestId }),
      ...(opts.raw !== undefined && { raw: opts.raw }),
    });
    this.name = 'IsaLicenseError';
    this.code = code;
  }
}

/**
 * 429 Too Many Requests. `retryAfterSeconds` carries the server's
 * `Retry-After` hint when present so callers can back off precisely rather
 * than guessing.
 */
export class IsaRateLimitError extends IsaApiError {
  /** Seconds the caller should wait before retrying, when the server said so. */
  public readonly retryAfterSeconds: number | undefined;

  constructor(opts: { message: string; code?: string; retryAfterSeconds?: number; requestId?: string; raw?: unknown }) {
    super({
      message: opts.message,
      code: opts.code ?? 'rate_limit_exceeded',
      status: 429,
      ...(opts.requestId !== undefined && { requestId: opts.requestId }),
      ...(opts.raw !== undefined && { raw: opts.raw }),
    });
    this.name = 'IsaRateLimitError';
    this.retryAfterSeconds = opts.retryAfterSeconds;
  }
}
