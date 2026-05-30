/**
 * Phase 1 — IsaIdempotencyConflictError surfaces from 409 ProblemDetails
 * with `idempotency_conflict` code (SDK_DESIGN §10.3).
 */
import { describe, it, expect } from 'vitest';
import {
  IsaIdempotencyConflictError,
  IsaApiError,
  RateLimitedError,
  fromHttpResponse,
  fromProblemDetails,
} from '../../src/zyins';

const CONFLICT_BODY = JSON.stringify({
  type: 'https://docs.isaapi.com/errors/idempotency_conflict',
  title: 'Idempotency conflict',
  status: 409,
  code: 'idempotency_conflict',
  detail: 'key was first used with a different body',
  key: '550e8400-e29b-41d4-a716-446655440000',
  first_seen_at: '2026-05-18T12:34:56Z',
  request_id: 'req_01HZ',
  doc_url: 'https://docs.isaapi.com/errors/idempotency_conflict',
});

describe('IsaIdempotencyConflictError', () => {
  it('is an IsaApiError with status 409 and code idempotency_conflict', () => {
    const err = new IsaIdempotencyConflictError({
      message: 'conflict',
      key: 'k',
      firstSeenAt: 't',
    });
    expect(err).toBeInstanceOf(IsaApiError);
    expect(err.status).toBe(409);
    expect(err.code).toBe('idempotency_conflict');
    expect(err.key).toBe('k');
    expect(err.firstSeenAt).toBe('t');
  });

  it('is thrown by fromHttpResponse on 409 + idempotency_conflict body', () => {
    const err = fromHttpResponse(409, CONFLICT_BODY);
    expect(err).toBeInstanceOf(IsaIdempotencyConflictError);
    const conflict = err as IsaIdempotencyConflictError;
    expect(conflict.key).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(conflict.firstSeenAt).toBe('2026-05-18T12:34:56Z');
    expect(conflict.requestId).toBe('req_01HZ');
    expect(conflict.docUrl).toBe('https://docs.isaapi.com/errors/idempotency_conflict');
  });

  it('is thrown by fromProblemDetails directly', () => {
    const parsed = JSON.parse(CONFLICT_BODY);
    const err = fromProblemDetails(parsed);
    expect(err).toBeInstanceOf(IsaIdempotencyConflictError);
  });
});

describe('RateLimitedError', () => {
  it('uses the server rate_limit_exceeded code for raw 429 responses', () => {
    const err = fromHttpResponse(429, 'slow down');
    expect(err).toBeInstanceOf(RateLimitedError);
    expect(err.code).toBe('rate_limit_exceeded');
  });

  it('maps rate_limit_exceeded ProblemDetails to RateLimitedError', () => {
    const err = fromProblemDetails({
      type: 'https://docs.isaapi.com/errors/rate_limit_exceeded',
      title: 'Too Many Requests',
      status: 429,
      code: 'rate_limit_exceeded',
      detail: 'slow down',
    });
    expect(err).toBeInstanceOf(RateLimitedError);
    expect(err.code).toBe('rate_limit_exceeded');
  });

  it('keeps legacy rate_limited ProblemDetails as rate limited', () => {
    const err = fromProblemDetails({
      type: 'https://docs.isaapi.com/errors/rate_limited',
      title: 'Too Many Requests',
      status: 429,
      code: 'rate_limited',
      detail: 'slow down',
    });
    expect(err).toBeInstanceOf(RateLimitedError);
    expect(err.code).toBe('rate_limited');
  });
});
