/**
 * Typed error hierarchy for the Tier 3 RapidSign facade.
 *
 * Callers switch on `error.code` (the wire `ErrorCode` enum, mirrored as
 * lowercase snake_case strings here per ADR-012) — never on HTTP status,
 * never on `instanceof` for any subclass not exported below.
 *
 * The base is abstract so `new RapidSignError(...)` is impossible — every
 * thrown error has a specific subclass with a stable `code`.
 */

import { isProblemDetails, type ProblemDetails } from '../core/index.js';

/**
 * Wire-stable error codes mirroring `api.isa.v1.ErrorCode` values in their
 * lowercase snake_case form. Cross-language SDKs share this set.
 */
export type ErrorCode =
  | 'unauthorized'
  | 'token_expired'
  | 'invalid_token'
  | 'forbidden'
  | 'not_found'
  | 'method_not_allowed'
  | 'conflict'
  | 'validation_error'
  | 'license_locked'
  | 'rate_limit_exceeded'
  | 'rate_limited'
  | 'internal_error'
  | 'bad_gateway'
  | 'gateway_timeout'
  | 'deadline_exceeded'
  | 'service_unavailable'
  | 'not_implemented'
  | 'unknown';

/** Fields every RapidSignError subclass receives at construction. */
export interface RapidSignErrorInit {
  readonly httpStatus: number;
  readonly requestId: string;
  readonly retryAfterMs?: number;
  readonly param?: string;
  readonly docUrl?: string;
  readonly retryable?: boolean;
  /** Wire code from ProblemDetails when it differs from the subclass default. */
  readonly wireCode?: ErrorCode;
}

/**
 * Abstract base class. Every error thrown by the RapidSign SDK is a subclass.
 * Callers `import { RapidSignError } from '@isa-sdk/rapidsign'` and either:
 *
 *   - `if (err instanceof RapidSignError) ...` for a broad catch
 *   - `if (err instanceof RapidSignError.NotFound) ...` for a specific catch
 *   - `switch (err.code) { case 'conflict': ... }` for exhaustive dispatch
 */
export abstract class RapidSignError extends Error {
  /** Stable wire code; consumers switch on this. */
  public abstract readonly code: ErrorCode;
  public readonly httpStatus: number;
  public readonly requestId: string;
  /** Whether a bounded retry has any chance of succeeding. */
  public readonly retryable: boolean;
  /** When `retryable === true`, the server-suggested delay. */
  public readonly retryAfterMs?: number;
  /** JSON-pointer to the failing field (validation_error only). */
  public readonly param?: string;
  /** Link to the docs page explaining this error and remediation. */
  public readonly docUrl?: string;

  constructor(message: string, init: RapidSignErrorInit) {
    super(message);
    this.name = new.target.name;
    this.httpStatus = init.httpStatus;
    this.requestId = init.requestId;
    this.retryable = init.retryable ?? false;
    if (init.retryAfterMs !== undefined) this.retryAfterMs = init.retryAfterMs;
    if (init.param !== undefined) this.param = init.param;
    if (init.docUrl !== undefined) this.docUrl = init.docUrl;
  }
}

/* eslint-disable @typescript-eslint/no-namespace */
export namespace RapidSignError {
  /** 401 — missing or invalid bearer token. */
  export class Unauthorized extends RapidSignError {
    public override readonly code = 'unauthorized' as const;
  }

  /** 401 specifically signalled with TOKEN_EXPIRED — caller should refresh. */
  export class TokenExpired extends RapidSignError {
    public override readonly code = 'token_expired' as const;
  }

  /** 401 specifically signalled with INVALID_TOKEN. */
  export class InvalidToken extends RapidSignError {
    public override readonly code = 'invalid_token' as const;
  }

  /** 403 — authenticated but lacking the scope for this operation. */
  export class Forbidden extends RapidSignError {
    public override readonly code = 'forbidden' as const;
  }

  /** 404 — document or sign id does not exist. */
  export class NotFound extends RapidSignError {
    public override readonly code = 'not_found' as const;
  }

  /** 405 — HTTP method not allowed on this path. */
  export class MethodNotAllowed extends RapidSignError {
    public override readonly code = 'method_not_allowed' as const;
  }

  /** 409 — state conflict (already signed, already cancelled, etc.). */
  export class Conflict extends RapidSignError {
    public override readonly code = 'conflict' as const;
  }

  /** 400 — request body failed schema/domain validation; `param` is set. */
  export class ValidationError extends RapidSignError {
    public override readonly code = 'validation_error' as const;
    /** Field path the validator rejected (e.g. `applicant.dob`). */
    public readonly field?: string;
    constructor(message: string, init: RapidSignErrorInit) {
      super(message, init);
      if (init.param !== undefined) this.field = init.param;
    }
  }

  /** 423 — license is locked (admin action or too many devices). */
  export class LicenseLocked extends RapidSignError {
    public override readonly code = 'license_locked' as const;
  }

  /** 429 — rate limit exceeded. `retryAfterMs` is always set. */
  export class RateLimited extends RapidSignError {
    public override readonly code: ErrorCode;
    constructor(message: string, init: RapidSignErrorInit) {
      super(message, { ...init, retryable: true });
      this.code = resolveRateLimitCode(init.wireCode);
    }
  }

  /** 500 — unhandled server fault. */
  export class InternalError extends RapidSignError {
    public override readonly code = 'internal_error' as const;
    constructor(message: string, init: RapidSignErrorInit) {
      super(message, { ...init, retryable: true });
    }
  }

  /** 502 — upstream dependency returned an unusable response. */
  export class BadGateway extends RapidSignError {
    public override readonly code = 'bad_gateway' as const;
    constructor(message: string, init: RapidSignErrorInit) {
      super(message, { ...init, retryable: true });
    }
  }

  /** 504 — upstream dependency did not respond. */
  export class GatewayTimeout extends RapidSignError {
    public override readonly code = 'gateway_timeout' as const;
    constructor(message: string, init: RapidSignErrorInit) {
      super(message, { ...init, retryable: true });
    }
  }

  /**
   * Client-side deadline — polling or wait budget exhausted without success.
   * Distinct from server `gateway_timeout` (504).
   */
  export class DeadlineExceeded extends RapidSignError {
    public override readonly code = 'deadline_exceeded' as const;
  }

  /** 503 — service is intentionally unavailable. */
  export class ServiceUnavailable extends RapidSignError {
    public override readonly code = 'service_unavailable' as const;
    constructor(message: string, init: RapidSignErrorInit) {
      super(message, { ...init, retryable: true });
    }
  }

  /**
   * 501 — capability not yet implemented (e.g. `cancel`, webhooks).
   *
   * Today this also funnels client-side stub paths: the SDK surface includes
   * methods whose server endpoints have not landed (per issue #38). Those
   * methods throw `NotImplemented` with a message naming the tracking issue.
   */
  export class NotImplemented extends RapidSignError {
    public override readonly code = 'not_implemented' as const;
  }

  /** Fallback for malformed bodies, network anomalies, etc. */
  export class Unknown extends RapidSignError {
    public override readonly code = 'unknown' as const;
  }
}
/* eslint-enable @typescript-eslint/no-namespace */

/**
 * Parse an HTTP response into the appropriate `RapidSignError` subclass.
 *
 * Resolution order:
 *   1. Body is RFC 7807 ProblemDetails → map by `code`.
 *   2. Body is non-JSON or schema-non-conforming → map by HTTP status.
 *   3. Fallback → `Unknown`.
 *
 * The caller always receives a typed error; `null`/`undefined` is never
 * returned for malformed responses.
 */
export function fromHttpResponse(
  status: number,
  body: string,
  headers: Record<string, string>,
): RapidSignError {
  const requestId = headers['x-request-id'] ?? headers['request-id'] ?? '';
  const retryAfterMs = parseRetryAfter(headers['retry-after']);
  const problem = tryParseProblemDetails(body);
  if (problem !== undefined) {
    return fromProblemDetails(problem, { requestId, retryAfterMs });
  }
  return fromHttpStatus(status, body.trim(), { httpStatus: status, requestId, retryAfterMs });
}

/** Map a parsed ProblemDetails into the right subclass. */
export function fromProblemDetails(
  problem: ProblemDetails,
  extra: { requestId: string; retryAfterMs?: number },
): RapidSignError {
  const init: RapidSignErrorInit = {
    httpStatus: problem.status,
    requestId: (problem as { request_id?: string }).request_id ?? extra.requestId,
    ...(extra.retryAfterMs !== undefined && { retryAfterMs: extra.retryAfterMs }),
    ...(problem.param !== undefined && { param: problem.param }),
    ...(problem.doc_url !== undefined && { docUrl: problem.doc_url }),
  };
  const message = problem.detail ?? problem.title;
  const Ctor = ERROR_CLASS_BY_CODE[problem.code];
  if (Ctor) {
    const wireCode = problem.code as ErrorCode;
    return new Ctor(message, {
      ...init,
      ...(Ctor === RapidSignError.RateLimited && { wireCode }),
    });
  }
  return fromHttpStatus(problem.status, message, init);
}

/**
 * Fallback mapper when the body is not ProblemDetails. Used for legacy
 * servers, gateway responses, and network-edge failures.
 */
function fromHttpStatus(
  status: number,
  body: string,
  init: RapidSignErrorInit,
): RapidSignError {
  const message = body || `HTTP ${status}`;
  const Ctor = ERROR_CLASS_BY_STATUS[status] ?? RapidSignError.Unknown;
  return new Ctor(message, { ...init, httpStatus: status });
}

const ERROR_CLASS_BY_CODE: Readonly<Record<string, new (m: string, i: RapidSignErrorInit) => RapidSignError>> = {
  unauthorized: RapidSignError.Unauthorized,
  token_expired: RapidSignError.TokenExpired,
  invalid_token: RapidSignError.InvalidToken,
  forbidden: RapidSignError.Forbidden,
  not_found: RapidSignError.NotFound,
  method_not_allowed: RapidSignError.MethodNotAllowed,
  conflict: RapidSignError.Conflict,
  validation_error: RapidSignError.ValidationError,
  license_locked: RapidSignError.LicenseLocked,
  rate_limit_exceeded: RapidSignError.RateLimited,
  rate_limited: RapidSignError.RateLimited,
  internal_error: RapidSignError.InternalError,
  bad_gateway: RapidSignError.BadGateway,
  gateway_timeout: RapidSignError.GatewayTimeout,
  service_unavailable: RapidSignError.ServiceUnavailable,
  not_implemented: RapidSignError.NotImplemented,
};

const ERROR_CLASS_BY_STATUS: Readonly<Record<number, new (m: string, i: RapidSignErrorInit) => RapidSignError>> = {
  400: RapidSignError.ValidationError,
  401: RapidSignError.Unauthorized,
  403: RapidSignError.Forbidden,
  404: RapidSignError.NotFound,
  405: RapidSignError.MethodNotAllowed,
  409: RapidSignError.Conflict,
  423: RapidSignError.LicenseLocked,
  429: RapidSignError.RateLimited,
  500: RapidSignError.InternalError,
  501: RapidSignError.NotImplemented,
  502: RapidSignError.BadGateway,
  503: RapidSignError.ServiceUnavailable,
  504: RapidSignError.GatewayTimeout,
};

/** Best-effort ProblemDetails parse; returns `undefined` for non-JSON bodies. */
function tryParseProblemDetails(body: string): ProblemDetails | undefined {
  const trimmed = body.trim();
  if (!trimmed.startsWith('{')) return undefined;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (isProblemDetails(parsed)) return parsed;
    // Some servers emit valid problem+json with `code` values outside the
    // strict @isa-sdk/core whitelist. Accept any object carrying the RFC
    // 7807 required fields.
    if (looksLikeProblemDetails(parsed)) return parsed as ProblemDetails;
    return undefined;
  } catch {
    return undefined;
  }
}

function looksLikeProblemDetails(v: unknown): boolean {
  if (v === null || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.title === 'string' &&
    typeof o.status === 'number' &&
    Number.isInteger(o.status) &&
    o.status >= 100 &&
    o.status <= 599 &&
    typeof o.code === 'string'
  );
}

const RETRY_AFTER_SECONDS_MAX = 86_400;
const RETRY_AFTER_MS_MAX = RETRY_AFTER_SECONDS_MAX * 1_000;

function parseRetryAfter(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) {
    const seconds = Number.parseInt(trimmed, 10);
    if (seconds >= 0 && seconds <= RETRY_AFTER_SECONDS_MAX) {
      return seconds * 1_000;
    }
    return undefined;
  }
  const asDate = Date.parse(trimmed);
  if (Number.isFinite(asDate)) {
    const delta = asDate - Date.now();
    if (delta <= 0) return 0;
    return Math.min(delta, RETRY_AFTER_MS_MAX);
  }
  return undefined;
}

function resolveRateLimitCode(wireCode: ErrorCode | undefined): ErrorCode {
  if (wireCode === 'rate_limited' || wireCode === 'rate_limit_exceeded') {
    return wireCode;
  }
  return 'rate_limit_exceeded';
}
