/**
 * Tier 3 typed error funnel.
 *
 * The ZyINS API speaks two error dialects in flight today:
 *
 * 1. Modern ProblemDetails (RFC 7807) — the future. Returned by the new
 *    Connect-RPC v1 endpoints.
 * 2. Legacy ERR_* magic strings — returned by the licensing CGI as raw
 *    text/plain. bpp2.0's `useSoftwareActivator.js` today switches on each
 *    string with a 7-branch if-chain.
 *
 * Tier 3 absorbs both into one typed funnel: `fromHttpResponse` parses the
 * status + body and returns a `ZyInsError` subclass. The caller switches on
 * `error.code` — never on HTTP status, never on message text. This is the
 * "legacy error formats are absorbed" invariant from ADR-035.
 */

import { isProblemDetails, type ProblemDetails } from '../core';
import { IsaIdempotencyConflictError } from './apiError';

/**
 * License-specific error codes. Drawn from the legacy CGI's ERR_* set;
 * additions ship with API minor versions. The string values are stable
 * across SDK releases (consumers switch on them).
 */
export type LicenseErrorCode =
  | 'max_activations'
  | 'inactive'
  | 'active_elsewhere'
  | 'locked'
  | 'invalid_credentials'
  | 'no_email'
  | 'unknown';

/**
 * Prequalify-specific error codes. The validation_error case carries a
 * `param` field naming which input failed.
 */
export type PrequalifyErrorCode = 'validation_error' | 'engine_error' | 'unknown';

/**
 * Base class for every error the Tier 3 facade emits. Mirrors the
 * ProblemDetails shape so callers get the same field set whether the
 * underlying response was JSON or a legacy ERR_* string.
 */
export class ZyInsError extends Error {
  public readonly code: string;
  public readonly httpStatus?: number;
  public readonly requestId?: string;
  public readonly adviceCode?: string;
  public readonly docUrl?: string;
  public readonly param?: string;

  constructor(
    message: string,
    opts: {
      code: string;
      httpStatus?: number;
      requestId?: string;
      adviceCode?: string;
      docUrl?: string;
      param?: string;
    },
  ) {
    super(message);
    this.name = 'ZyInsError';
    this.code = opts.code;
    if (opts.httpStatus !== undefined) this.httpStatus = opts.httpStatus;
    if (opts.requestId !== undefined) this.requestId = opts.requestId;
    if (opts.adviceCode !== undefined) this.adviceCode = opts.adviceCode;
    if (opts.docUrl !== undefined) this.docUrl = opts.docUrl;
    if (opts.param !== undefined) this.param = opts.param;
  }
}

/** License activation / deactivation errors. */
export class LicenseError extends ZyInsError {
  public override readonly code: LicenseErrorCode;
  constructor(code: LicenseErrorCode, message: string, httpStatus?: number) {
    const opts: ConstructorParameters<typeof ZyInsError>[1] = { code };
    if (httpStatus !== undefined) opts.httpStatus = httpStatus;
    super(message, opts);
    this.name = 'LicenseError';
    this.code = code;
  }
}

/** Prequalify validation / engine errors. */
export class PrequalifyError extends ZyInsError {
  public override readonly code: PrequalifyErrorCode;
  constructor(code: PrequalifyErrorCode, message: string, opts: { httpStatus?: number; param?: string } = {}) {
    const baseOpts: ConstructorParameters<typeof ZyInsError>[1] = { code };
    if (opts.httpStatus !== undefined) baseOpts.httpStatus = opts.httpStatus;
    if (opts.param !== undefined) baseOpts.param = opts.param;
    super(message, baseOpts);
    this.name = 'PrequalifyError';
    this.code = code;
  }
}

/** 429 with optional Retry-After hint. */
export class RateLimitedError extends ZyInsError {
  /** Seconds the caller should wait before retrying, when known. */
  public readonly retryAfterSeconds?: number;
  constructor(
    message: string,
    opts: { code?: 'rate_limit_exceeded' | 'rate_limited'; httpStatus: number; retryAfterSeconds?: number } = {
      httpStatus: 429,
    },
  ) {
    super(message, { code: opts.code ?? 'rate_limit_exceeded', httpStatus: opts.httpStatus });
    this.name = 'RateLimitedError';
    if (opts.retryAfterSeconds !== undefined) this.retryAfterSeconds = opts.retryAfterSeconds;
  }
}

/**
 * Parse a raw HTTP response (status + body) into a typed `ZyInsError`.
 *
 * Resolution order:
 * 1. Body is a ProblemDetails JSON → map by `code`.
 * 2. Body is a legacy ERR_* string → map by token table.
 * 3. Body is `NO_EMAIL` (the licensing CGI's special case) → LicenseError.
 * 4. Fallback → `ZyInsError` with code `unknown`.
 *
 * The caller always gets a typed value; `null` or `undefined` is never
 * returned even for malformed responses. This is the absorption boundary.
 */
export function fromHttpResponse(status: number, body: string): ZyInsError {
  const trimmed = body.trim();
  if (status === 429) {
    return new RateLimitedError(trimmed || 'rate limited', { httpStatus: 429 });
  }
  const asProblem = tryParseProblemDetails(trimmed);
  if (asProblem) return fromProblemDetails(asProblem);
  const asLegacy = tryParseLegacyErr(status, trimmed);
  if (asLegacy) return asLegacy;
  return new ZyInsError(trimmed || `HTTP ${status}`, { code: 'unknown', httpStatus: status });
}

/** Map a parsed ProblemDetails into the right Tier 3 subclass. */
export function fromProblemDetails(problem: ProblemDetails): ZyInsError {
  const opts = {
    httpStatus: problem.status,
    ...(problem.param !== undefined && { param: problem.param }),
    ...(problem.doc_url !== undefined && { docUrl: problem.doc_url }),
  };
  if ((problem.code as string) === 'idempotency_conflict') {
    const raw = problem as ProblemDetails & {
      key?: unknown;
      first_seen_at?: unknown;
      request_id?: unknown;
    };
    const ctorOpts: ConstructorParameters<typeof IsaIdempotencyConflictError>[0] = {
      message: problem.detail ?? problem.title,
      key: typeof raw.key === 'string' ? raw.key : '',
      firstSeenAt: typeof raw.first_seen_at === 'string' ? raw.first_seen_at : '',
      raw: problem,
    };
    if (typeof raw.request_id === 'string') ctorOpts.requestId = raw.request_id;
    if (problem.doc_url !== undefined) ctorOpts.docUrl = problem.doc_url;
    return new IsaIdempotencyConflictError(ctorOpts);
  }
  if (problem.code === 'license_locked') {
    return new LicenseError('locked', problem.detail ?? problem.title, problem.status);
  }
  if (problem.code === 'validation_error') {
    const peOpts: { httpStatus?: number; param?: string } = { httpStatus: problem.status };
    if (problem.param !== undefined) peOpts.param = problem.param;
    return new PrequalifyError('validation_error', problem.detail ?? problem.title, peOpts);
  }
  if (problem.code === 'rate_limit_exceeded' || problem.code === 'rate_limited') {
    return new RateLimitedError(problem.detail ?? problem.title, { code: problem.code, httpStatus: problem.status });
  }
  return new ZyInsError(problem.detail ?? problem.title, { code: problem.code, ...opts });
}

const LEGACY_ERR_MAP: Readonly<Record<string, LicenseErrorCode>> = {
  ERR_MAX_ACTIVATIONS: 'max_activations',
  ERR_INACTIVE: 'inactive',
  ERR_ACTIVE_ELSEWHERE: 'active_elsewhere',
  ERR_LOCKED: 'locked',
  ERR_INVALID_CREDENTIALS: 'invalid_credentials',
  NO_EMAIL: 'no_email',
};

/** Best-effort ProblemDetails parse; returns `undefined` for non-JSON bodies. */
function tryParseProblemDetails(body: string): ProblemDetails | undefined {
  if (!body.startsWith('{')) return undefined;
  try {
    const parsed: unknown = JSON.parse(body);
    return isProblemDetails(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Map a known legacy token to a LicenseError. Unknown `ERR_*` strings
 * collapse to `unknown` so consumers never have to mirror the exhaustive
 * token list themselves.
 */
function tryParseLegacyErr(status: number, body: string): LicenseError | undefined {
  const mapped = LEGACY_ERR_MAP[body];
  if (mapped) return new LicenseError(mapped, body, status);
  if (body.startsWith('ERR_')) return new LicenseError('unknown', body, status);
  return undefined;
}
