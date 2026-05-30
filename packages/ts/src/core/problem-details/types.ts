/**
 * RFC 7807 Problem Details types shared with platform-php's ProblemException.
 *
 * Error codes are drawn from ADR-012 (the platform-wide error taxonomy). The
 * list below is the v1 set; revisions MUST update both this file and the PHP
 * ProblemException enum in the same commit to preserve type parity.
 */

/**
 * The authoritative list of platform error codes. Revisions MUST update both
 * this array and `platform-php`'s `ProblemException` enum in the same commit.
 */
export const PROBLEM_DETAILS_CODES = [
  'unauthorized',
  'token_expired',
  'validation_error',
  'license_locked',
  'not_found',
  'forbidden',
  'conflict',
  'rate_limit_exceeded',
  'rate_limited',
  'internal_error',
  'service_unavailable',
  'idempotency_conflict',
] as const;

export type ProblemDetailsCode = (typeof PROBLEM_DETAILS_CODES)[number];

const PROBLEM_DETAILS_CODE_SET: ReadonlySet<string> = new Set<string>(PROBLEM_DETAILS_CODES);

export interface ProblemDetails {
  /** URI reference identifying the problem type. */
  type: string;
  /** Short, human-readable summary. */
  title: string;
  /** HTTP status code emitted by the origin server. */
  status: number;
  /** Machine-readable error code (stable; consumers switch on this). */
  code: ProblemDetailsCode;
  /** Human-readable explanation specific to this occurrence. */
  detail?: string;
  /** URI reference identifying the specific occurrence. */
  instance?: string;
  /** Name of the request parameter that failed validation. */
  param?: string;
  /** Link to public documentation for this error code. */
  doc_url?: string;
}

/** Type guard — narrow `unknown` to ProblemDetails. */
export function isProblemDetails(value: unknown): value is ProblemDetails {
  if (value === null || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.type === 'string' &&
    typeof v.title === 'string' &&
    isHttpStatus(v.status) &&
    typeof v.code === 'string' &&
    PROBLEM_DETAILS_CODE_SET.has(v.code)
  );
}

/** RFC 9110 status codes are integers in [100, 599]. */
function isHttpStatus(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 100 && value <= 599;
}
