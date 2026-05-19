import { describe, expect, it, vi } from 'vitest';
import { proxyCall } from '../../src/proxy/transport/call';

const SALT = 'abcdefghijklmnopqrstuvwxyz0123456789';
const FIXED_TIME = 1_700_000_000_000;

function makeFetch() {
  return vi.fn(async (url: RequestInfo | URL, init: RequestInit = {}) => {
    const urlStr = String(url);
    // First call: salt fetch from the authorizer proxy.
    if (urlStr.includes('get-authorizer-content')) {
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => SALT,
        json: async () => ({}),
        headers: new Headers(),
      } as Response;
    }
    // Second call: the /v1/call envelope. parseEcho throws loudly on a
    // malformed fixture — that's intentional test behavior.
    const parseEcho = (raw: string): unknown => JSON.parse(raw);
    const envelope = {
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: { echoed: parseEcho(String(init.body ?? '{}')) },
    };
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => JSON.stringify(envelope),
      json: async () => envelope,
      headers: new Headers(),
    } as Response;
  }) as unknown as typeof fetch;
}

describe('proxyCall', () => {
  it('sends the structured envelope to {proxyOrigin}/v1/call with Algosure headers', async () => {
    const f = makeFetch();
    const response = await proxyCall({
      proxyOrigin: 'https://proxy.isaapi.com',
      integrationId: 'zyins',
      params: { path: '/v1/foo', method: 'GET', body: null },
      host: 'customer.com',
      sessionId: 'sess-1',
      clock: () => FIXED_TIME,
      fetchImpl: f,
    });

    expect(response.status).toBe(200);

    const fnMock = f as unknown as { mock: { calls: [RequestInfo | URL, RequestInit][] } };
    const envelopeCall = fnMock.mock.calls.find(([u]) =>
      String(u).endsWith('/v1/call'),
    );
    expect(envelopeCall).toBeDefined();

    const [url, init] = envelopeCall!;
    expect(String(url)).toBe('https://proxy.isaapi.com/v1/call');
    expect(init.method).toBe('POST');

    const headers = new Headers(init.headers);
    expect(headers.get('Authorization')).toMatch(/^[0-9a-f]{64}$/);
    expect(headers.get('*Host')).toBe('customer.com');
    expect(headers.get('*Timestamp')).toBe(String(FIXED_TIME));
    expect(headers.get('*sessionId')).toBe('sess-1');

    const body = JSON.parse(String(init.body));
    expect(body.integration_id).toBe('zyins');
    expect(body.params.path).toBe('/v1/foo');

    // Request body on the wire must be a string (not a re-serialized object),
    // so the bytes the HMAC was computed over equal the bytes transmitted.
    expect(typeof init.body).toBe('string');
  });

  it('rejects a malformed proxy response missing status/headers', async () => {
    const HTTP_STATUS_OK = 200;
    const f = vi.fn(async (url: RequestInfo | URL) => {
      if (String(url).includes('get-authorizer-content')) {
        return {
          ok: true,
          status: HTTP_STATUS_OK,
          statusText: 'OK',
          text: async () => SALT,
          json: async () => ({}),
          headers: new Headers(),
        } as Response;
      }
      // Response missing `status` and `headers` — should be rejected.
      const malformed = { foo: 'bar' };
      return {
        ok: true,
        status: HTTP_STATUS_OK,
        statusText: 'OK',
        text: async () => JSON.stringify(malformed),
        json: async () => malformed,
        headers: new Headers(),
      } as Response;
    }) as unknown as typeof fetch;

    await expect(
      proxyCall({
        proxyOrigin: 'https://proxy.isaapi.com',
        integrationId: 'zyins',
        params: { path: '/v1/foo', method: 'GET' },
        host: 'customer.com',
        sessionId: 'sess-1',
        clock: () => FIXED_TIME,
        fetchImpl: f,
      }),
    ).rejects.toThrow(/malformed response/);
  });

  it('strips trailing slashes from proxyOrigin', async () => {
    const f = makeFetch();
    await proxyCall({
      proxyOrigin: 'https://proxy.isaapi.com/',
      integrationId: 'zyins',
      params: { path: '/v1/foo', method: 'GET' },
      host: 'customer.com',
      sessionId: 'sess-1',
      clock: () => FIXED_TIME,
      fetchImpl: f,
    });
    const fnMock = f as unknown as { mock: { calls: [RequestInfo | URL, RequestInit][] } };
    const call = fnMock.mock.calls.find(([u]) => String(u).endsWith('/v1/call'));
    expect(String(call![0])).toBe('https://proxy.isaapi.com/v1/call');
  });

  it('rejects a malformed proxy response whose headers field is an array', async () => {
    // Regression: isStringRecord previously accepted ['a', 'b'] because
    // `typeof [] === 'object'` and `Object.values(array).every(typeof 'string')`
    // both succeed. Downstream `headers['content-type']` then returned undefined.
    const f = vi.fn(async (url: RequestInfo | URL) => {
      if (String(url).includes('get-authorizer-content')) {
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          text: async () => SALT,
          json: async () => ({}),
          headers: new Headers(),
        } as Response;
      }
      const malformed = { status: 200, headers: ['content-type', 'text/plain'], body: {} };
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => JSON.stringify(malformed),
        json: async () => malformed,
        headers: new Headers(),
      } as Response;
    }) as unknown as typeof fetch;

    await expect(
      proxyCall({
        proxyOrigin: 'https://proxy.isaapi.com',
        integrationId: 'zyins',
        params: { path: '/v1/foo', method: 'GET' },
        host: 'customer.com',
        sessionId: 'sess-1',
        clock: () => FIXED_TIME,
        fetchImpl: f,
      }),
    ).rejects.toThrow(/malformed response/);
  });

  it('forwards the caller signal to the main /v1/call request (not only salt)', async () => {
    const controller = new AbortController();
    let mainInit: RequestInit | undefined;
    const f = vi.fn(async (url: RequestInfo | URL, init: RequestInit = {}) => {
      if (String(url).includes('get-authorizer-content')) {
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          text: async () => SALT,
          json: async () => ({}),
          headers: new Headers(),
        } as Response;
      }
      mainInit = init;
      const envelope = { status: 200, headers: { 'content-type': 'application/json' }, body: {} };
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => JSON.stringify(envelope),
        json: async () => envelope,
        headers: new Headers(),
      } as Response;
    }) as unknown as typeof fetch;

    await proxyCall({
      proxyOrigin: 'https://proxy.isaapi.com',
      integrationId: 'zyins',
      params: { path: '/v1/foo', method: 'GET' },
      host: 'customer.com',
      sessionId: 'sess-1',
      clock: () => FIXED_TIME,
      fetchImpl: f,
      signal: controller.signal,
    });

    expect(mainInit?.signal).toBeDefined();
    expect(mainInit!.signal!.aborted).toBe(false);
    // Aborting the caller signal must propagate to the main request's
    // composed signal, not just the salt fetch.
    controller.abort();
    expect(mainInit!.signal!.aborted).toBe(true);
  });
});
