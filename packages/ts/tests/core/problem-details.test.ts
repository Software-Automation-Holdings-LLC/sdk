import { describe, expect, it } from 'vitest';
import {
  isProblemDetails,
  type ProblemDetails,
  type ProblemDetailsCode,
} from '../../src/core/problem-details/types';

const HTTP_STATUS_BAD_REQUEST = 400;
const HTTP_STATUS_UNPROCESSABLE = 422;
const HTTP_STATUS_INTERNAL = 500;

describe('ProblemDetails types', () => {
  it('accepts a well-formed ProblemDetails object', () => {
    const p: ProblemDetails = {
      type: 'https://docs.example.com/errors/unauthorized',
      title: 'Unauthorized',
      status: 401,
      code: 'unauthorized',
      detail: 'Missing Authorization header',
    };
    expect(isProblemDetails(p)).toBe(true);
  });

  it('rejects null, undefined, and primitives', () => {
    expect(isProblemDetails(null)).toBe(false);
    expect(isProblemDetails(undefined)).toBe(false);
    expect(isProblemDetails('error')).toBe(false);
    expect(isProblemDetails(404)).toBe(false);
  });

  it('rejects objects missing required fields', () => {
    expect(isProblemDetails({ type: 'x' })).toBe(false);
    expect(isProblemDetails({ type: 'x', title: 'y', status: 500 })).toBe(false);
  });

  it('rejects objects whose code is not a member of the union', () => {
    expect(
      isProblemDetails({
        type: 't',
        title: 'T',
        status: HTTP_STATUS_INTERNAL,
        code: 'fake_code',
      }),
    ).toBe(false);
  });

  it('accepts every documented code', () => {
    const codes: ProblemDetailsCode[] = [
      'unauthorized',
      'token_expired',
      'validation_error',
      'license_locked',
      'not_found',
      'forbidden',
      'conflict',
      'rate_limited',
      'internal_error',
      'service_unavailable',
    ];
    for (const code of codes) {
      expect(
        isProblemDetails({ type: 't', title: 'T', status: HTTP_STATUS_BAD_REQUEST, code }),
      ).toBe(true);
    }
  });

  it('round-trips through JSON.stringify / JSON.parse', () => {
    const p: ProblemDetails = {
      type: 'https://docs.example.com/errors/validation',
      title: 'Bad Request',
      status: HTTP_STATUS_UNPROCESSABLE,
      code: 'validation_error',
      detail: 'email is required',
      param: 'email',
    };
    const parsed = JSON.parse(JSON.stringify(p));
    expect(isProblemDetails(parsed)).toBe(true);
    expect(parsed).toEqual(p);
  });

  it('rejects non-HTTP status values (non-integer, out of 100-599 range)', () => {
    const base = { type: 't', title: 'T', code: 'not_found' as ProblemDetailsCode };
    expect(isProblemDetails({ ...base, status: 0 })).toBe(false);
    expect(isProblemDetails({ ...base, status: 99 })).toBe(false);
    expect(isProblemDetails({ ...base, status: 600 })).toBe(false);
    expect(isProblemDetails({ ...base, status: 404.5 })).toBe(false);
    expect(isProblemDetails({ ...base, status: Number.NaN })).toBe(false);
    expect(isProblemDetails({ ...base, status: 404 })).toBe(true);
  });

  it('narrows unknown to ProblemDetails via the type guard', () => {
    const u: unknown = {
      type: 't',
      title: 'T',
      status: 500,
      code: 'internal_error' as ProblemDetailsCode,
    };
    if (isProblemDetails(u)) {
      // Type-level assertion — compiles only if narrowing worked.
      const code: ProblemDetailsCode = u.code;
      expect(code).toBe('internal_error');
    } else {
      expect.fail('type guard should have matched');
    }
  });
});
