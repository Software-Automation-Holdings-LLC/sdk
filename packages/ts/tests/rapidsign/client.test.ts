import { describe, expect, it } from 'vitest';
import { RapidSignClient, DEFAULT_RAPIDSIGN_BASE_URL } from '../../src/rapidsign/client';
import { RapidSignError, fromHttpResponse, fromProblemDetails } from '../../src/rapidsign/errors';
import {
  TEST_TOKEN,
  TEST_BASE,
  FIXED_CLOCK,
  counterUUID,
  instantSleeper,
  queueTransport,
} from './fixtures';

describe('RapidSignClient', () => {
  it('rejects construction without a bearer token', () => {
    expect(() => new RapidSignClient('')).toThrow(RapidSignError.ValidationError);
    expect(() => new RapidSignClient('   ')).toThrow(RapidSignError.ValidationError);
    // @ts-expect-error — verifying runtime guard on bad input
    expect(() => new RapidSignClient(undefined)).toThrow();
  });

  it('trims whitespace from the bearer token', async () => {
    const { transport, calls } = queueTransport([
      { status: 404, body: 'not found' },
    ]);
    const { sleeper } = instantSleeper();
    const client = new RapidSignClient(`  ${TEST_TOKEN}  `, {
      baseUrl: TEST_BASE,
      transport,
      clock: FIXED_CLOCK,
      sleeper,
      uuid: counterUUID(),
    });
    await expect(client.documents.get('sig_x')).rejects.toBeInstanceOf(RapidSignError.NotFound);
    expect(calls[0]!.request.headers['Authorization']).toBe(`Bearer ${TEST_TOKEN}`);
  });

  it('exposes documents and webhooks namespaces', () => {
    const c = new RapidSignClient(TEST_TOKEN);
    expect(c.documents).toBeDefined();
    expect(c.webhooks).toBeDefined();
  });

  it('uses the production base URL by default', () => {
    expect(DEFAULT_RAPIDSIGN_BASE_URL).toBe('https://rapidsign.isaapi.com');
  });

  it('threads an Authorization: Bearer header into every call', async () => {
    const { transport, calls } = queueTransport([
      { status: 404, body: 'not found' },
    ]);
    const { sleeper } = instantSleeper();
    const client = new RapidSignClient(TEST_TOKEN, {
      baseUrl: TEST_BASE,
      transport,
      clock: FIXED_CLOCK,
      sleeper,
      uuid: counterUUID(),
    });
    await expect(client.documents.get('sig_x')).rejects.toBeInstanceOf(RapidSignError.NotFound);
    expect(calls[0]!.request.headers['Authorization']).toBe(`Bearer ${TEST_TOKEN}`);
    expect(calls[0]!.request.headers['User-Agent']).toMatch(/^@isa-sdk\/rapidsign-js/);
  });
});

describe('error mapping (fromHttpResponse / fromProblemDetails)', () => {
  const headers = { 'x-request-id': 'req_01HZK2N5GQR9T8X4B6FJW3Y1AS' };

  it('maps 401 to Unauthorized via HTTP status', () => {
    const err = fromHttpResponse(401, 'nope', headers);
    expect(err).toBeInstanceOf(RapidSignError.Unauthorized);
    expect(err.code).toBe('unauthorized');
    expect(err.requestId).toBe(headers['x-request-id']);
  });

  it('maps 403 to Forbidden', () => {
    expect(fromHttpResponse(403, '', headers)).toBeInstanceOf(RapidSignError.Forbidden);
  });

  it('maps 404 to NotFound', () => {
    expect(fromHttpResponse(404, '', headers)).toBeInstanceOf(RapidSignError.NotFound);
  });

  it('maps 405 to MethodNotAllowed', () => {
    expect(fromHttpResponse(405, '', headers)).toBeInstanceOf(RapidSignError.MethodNotAllowed);
  });

  it('maps 409 to Conflict', () => {
    expect(fromHttpResponse(409, '', headers)).toBeInstanceOf(RapidSignError.Conflict);
  });

  it('maps 423 to LicenseLocked', () => {
    expect(fromHttpResponse(423, '', headers)).toBeInstanceOf(RapidSignError.LicenseLocked);
  });

  it('maps 429 to RateLimited and exposes retryAfterMs from header', () => {
    const err = fromHttpResponse(429, '', { ...headers, 'retry-after': '7' });
    expect(err).toBeInstanceOf(RapidSignError.RateLimited);
    expect(err.retryAfterMs).toBe(7_000);
    expect(err.retryable).toBe(true);
  });

  it('maps 500 / 502 / 503 / 504 to the right transient subclasses', () => {
    expect(fromHttpResponse(500, '', headers)).toBeInstanceOf(RapidSignError.InternalError);
    expect(fromHttpResponse(502, '', headers)).toBeInstanceOf(RapidSignError.BadGateway);
    expect(fromHttpResponse(503, '', headers)).toBeInstanceOf(RapidSignError.ServiceUnavailable);
    expect(fromHttpResponse(504, '', headers)).toBeInstanceOf(RapidSignError.GatewayTimeout);
  });

  it('marks 5xx and 429 as retryable', () => {
    expect(fromHttpResponse(500, '', headers).retryable).toBe(true);
    expect(fromHttpResponse(502, '', headers).retryable).toBe(true);
    expect(fromHttpResponse(503, '', headers).retryable).toBe(true);
    expect(fromHttpResponse(504, '', headers).retryable).toBe(true);
    expect(fromHttpResponse(429, '', headers).retryable).toBe(true);
    expect(fromHttpResponse(400, '', headers).retryable).toBe(false);
  });

  it('preserves rate_limited wire code from ProblemDetails', () => {
    const body = JSON.stringify({
      type: 't',
      title: 'Slow down',
      status: 429,
      code: 'rate_limited',
      detail: 'too many requests',
    });
    const err = fromHttpResponse(429, body, headers);
    expect(err).toBeInstanceOf(RapidSignError.RateLimited);
    expect(err.code).toBe('rate_limited');
  });

  it('preserves ProblemDetails fields when code is unknown', () => {
    const body = JSON.stringify({
      type: 't',
      title: 'Future error',
      status: 404,
      code: 'future_not_found_variant',
      detail: 'missing resource',
      request_id: 'req_problem_body',
      param: 'sign_id',
      doc_url: 'https://docs.example/errors/not-found',
    });
    const err = fromHttpResponse(404, body, headers);
    expect(err).toBeInstanceOf(RapidSignError.NotFound);
    expect(err.requestId).toBe('req_problem_body');
    expect(err.param).toBe('sign_id');
    expect(err.docUrl).toBe('https://docs.example/errors/not-found');
  });

  it('falls back to HTTP status when ProblemDetails code is unknown', () => {
    const body = JSON.stringify({
      type: 't',
      title: 'Slow down',
      status: 429,
      code: 'future_rate_limit_variant',
      detail: 'too many requests',
    });
    const err = fromHttpResponse(429, body, headers);
    expect(err).toBeInstanceOf(RapidSignError.RateLimited);
    expect(err.retryable).toBe(true);
  });

  it('ignores malformed Retry-After tokens', () => {
    const err = fromHttpResponse(429, '', { 'retry-after': '10abc' });
    expect(err).toBeInstanceOf(RapidSignError.RateLimited);
    expect(err.retryAfterMs).toBeUndefined();
  });

  it('parses ProblemDetails and prefers its `code` over the HTTP status', () => {
    const body = JSON.stringify({
      type: 'https://docs.example/errors/conflict',
      title: 'Already signed',
      status: 409,
      code: 'conflict',
      detail: 'document already signed',
      request_id: 'req_problem_1',
    });
    const err = fromHttpResponse(409, body, headers);
    expect(err).toBeInstanceOf(RapidSignError.Conflict);
    expect(err.requestId).toBe('req_problem_1');
    expect(err.message).toBe('document already signed');
  });

  it('attaches `field` (from problem.param) on ValidationError', () => {
    const body = JSON.stringify({
      type: 't',
      title: 'Validation failed',
      status: 400,
      code: 'validation_error',
      detail: 'recipient.email is required',
      param: 'recipient.email',
    });
    const err = fromHttpResponse(400, body, headers);
    expect(err).toBeInstanceOf(RapidSignError.ValidationError);
    expect((err as RapidSignError.ValidationError).field).toBe('recipient.email');
    expect(err.param).toBe('recipient.email');
  });

  it('parses HTTP-date Retry-After', () => {
    const future = new Date(Date.now() + 5_000).toUTCString();
    const err = fromHttpResponse(429, '', { 'retry-after': future });
    expect(err.retryAfterMs).toBeGreaterThanOrEqual(0);
    expect(err.retryAfterMs).toBeLessThanOrEqual(5_500);
  });

  it('rejects ProblemDetails with an invalid HTTP status', () => {
    const body = JSON.stringify({
      type: 't',
      title: 'Bad problem',
      status: 0,
      code: 'internal_error',
    });
    const err = fromHttpResponse(500, body, headers);
    expect(err).toBeInstanceOf(RapidSignError.InternalError);
    expect(err.httpStatus).toBe(500);
  });

  it('falls back to Unknown for malformed body + unknown status', () => {
    const err = fromHttpResponse(418, "I'm a teapot", {});
    expect(err).toBeInstanceOf(RapidSignError.Unknown);
    expect(err.code).toBe('unknown');
  });

  it('fromProblemDetails routes not_implemented to NotImplemented', () => {
    const err = fromProblemDetails(
      {
        type: 't',
        title: 'Not yet implemented',
        status: 501,
        code: 'not_implemented' as never,
      },
      { requestId: 'req_x' },
    );
    expect(err).toBeInstanceOf(RapidSignError.NotImplemented);
  });
});
