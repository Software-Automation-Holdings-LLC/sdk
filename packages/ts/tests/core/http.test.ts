import { describe, expect, it, vi } from 'vitest';
import { HttpRequestError, httpRequest } from '../../src/core/http/request';

function mockFetch(response: Partial<Response> | ((init: RequestInit) => Partial<Response>)): typeof fetch {
  return vi.fn(async (_url: RequestInfo | URL, init: RequestInit = {}) => {
    const r = typeof response === 'function' ? response(init) : response;
    // Derive text() from json() when caller supplied json — keeps Response
    // semantics (text is the JSON's string form) so parseJsonBody works with
    // these mocks.
    const baseText = async (): Promise<string> =>
      r.json ? JSON.stringify(await r.json()) : '';
    return {
      ok: r.status !== undefined ? r.status >= 200 && r.status < 300 : true,
      status: 200,
      statusText: 'OK',
      text: baseText,
      json: async () => ({}),
      blob: async () => new Blob(),
      headers: new Headers(),
      ...r,
    } as Response;
  }) as unknown as typeof fetch;
}

describe('httpRequest success paths', () => {
  it('returns parsed JSON on 2xx', async () => {
    const f = mockFetch({ status: 200, json: async () => ({ hello: 'world' }) });
    const body = await httpRequest<{ hello: string }>({ url: 'https://api.test/a', fetchImpl: f });
    expect(body.hello).toBe('world');
  });

  it('returns text when returnType=TEXT', async () => {
    const f = mockFetch({ status: 200, text: async () => 'plain' });
    const body = await httpRequest<string>({
      url: 'https://api.test/a',
      returnType: 'TEXT',
      fetchImpl: f,
    });
    expect(body).toBe('plain');
  });

  it('calls applyAuthHeaders with the serialized body', async () => {
    const f = mockFetch({ status: 200, json: async () => ({}) });
    const applyAuthHeaders = vi.fn(async (_url, headers) => headers);
    await httpRequest({
      url: 'https://api.test/a',
      method: 'POST',
      body: { x: 1 },
      fetchImpl: f,
      applyAuthHeaders,
    });
    expect(applyAuthHeaders).toHaveBeenCalledOnce();
    const call = applyAuthHeaders.mock.calls[0];
    expect(call![2]).toBe('{"x":1}');
  });
});

describe('httpRequest error paths', () => {
  it('tags 4xx as non-transient', async () => {
    const f = mockFetch({ status: 404, statusText: 'Not Found', text: async () => '' });
    try {
      await httpRequest({ url: 'https://api.test/a', fetchImpl: f });
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpRequestError);
      const e = err as HttpRequestError;
      expect(e.status).toBe(404);
      expect(e.isTransient).toBe(false);
    }
  });

  it('tags 5xx as transient', async () => {
    const f = mockFetch({ status: 503, statusText: 'Unavailable', text: async () => '' });
    try {
      await httpRequest({ url: 'https://api.test/a', fetchImpl: f });
      expect.fail('should have thrown');
    } catch (err) {
      const e = err as HttpRequestError;
      expect(e.status).toBe(503);
      expect(e.isTransient).toBe(true);
    }
  });

  it('tags TypeError "failed to fetch" as transient network error', async () => {
    const f = vi.fn(async () => {
      throw new TypeError('failed to fetch');
    }) as unknown as typeof fetch;
    try {
      await httpRequest({ url: 'https://api.test/a', fetchImpl: f });
      expect.fail('should have thrown');
    } catch (err) {
      const e = err as HttpRequestError;
      expect(e.isTransient).toBe(true);
      expect(e.isCORS).toBe(false);
    }
  });

  it('tags CORS errors with isCORS=true and isTransient=false', async () => {
    const f = vi.fn(async () => {
      throw new TypeError('blocked by CORS policy');
    }) as unknown as typeof fetch;
    try {
      await httpRequest({ url: 'https://api.test/a', fetchImpl: f });
      expect.fail('should have thrown');
    } catch (err) {
      const e = err as HttpRequestError;
      expect(e.isCORS).toBe(true);
      expect(e.isTransient).toBe(false);
    }
  });

  it('tags aborts as transient timeout errors', async () => {
    const f = vi.fn(async () => {
      throw new DOMException('aborted', 'AbortError');
    }) as unknown as typeof fetch;
    try {
      await httpRequest({ url: 'https://api.test/a', fetchImpl: f, timeout: 100 });
      expect.fail('should have thrown');
    } catch (err) {
      const e = err as HttpRequestError;
      expect(e.isTransient).toBe(true);
      expect(e.message).toMatch(/timed out/);
    }
  });

  it('throws on missing URL', async () => {
    await expect(httpRequest({ url: '', fetchImpl: mockFetch({ status: 200 }) })).rejects.toThrow(/URL is required/);
  });
});

describe('httpRequest body encoding', () => {
  const HTTP_STATUS_OK = 200;

  it('adds Content-Type: application/json when auto-serializing a plain object', async () => {
    let seenHeaders: HeadersInit | undefined;
    const f = vi.fn(async (_url: RequestInfo | URL, init: RequestInit = {}) => {
      seenHeaders = init.headers;
      return {
        ok: true,
        status: HTTP_STATUS_OK,
        statusText: 'OK',
        text: async () => '{}',
        json: async () => ({}),
        headers: new Headers(),
      } as Response;
    }) as unknown as typeof fetch;
    await httpRequest({
      url: 'https://api.test/a',
      method: 'POST',
      body: { x: 1 },
      fetchImpl: f,
    });
    const h = new Headers(seenHeaders);
    expect(h.get('Content-Type')).toBe('application/json');
  });

  it('does not clobber a caller-supplied Content-Type', async () => {
    let seenHeaders: HeadersInit | undefined;
    const f = vi.fn(async (_url: RequestInfo | URL, init: RequestInit = {}) => {
      seenHeaders = init.headers;
      return {
        ok: true,
        status: HTTP_STATUS_OK,
        statusText: 'OK',
        text: async () => '{}',
        json: async () => ({}),
        headers: new Headers(),
      } as Response;
    }) as unknown as typeof fetch;
    await httpRequest({
      url: 'https://api.test/a',
      method: 'POST',
      body: { x: 1 },
      otherArgs: { headers: { 'content-type': 'application/vnd.custom+json' } },
      fetchImpl: f,
    });
    const h = new Headers(seenHeaders);
    expect(h.get('Content-Type')).toBe('application/vnd.custom+json');
  });

  it('does not inject Content-Type for native BodyInit types', async () => {
    let seenHeaders: HeadersInit | undefined;
    const f = vi.fn(async (_url: RequestInfo | URL, init: RequestInit = {}) => {
      seenHeaders = init.headers;
      return {
        ok: true,
        status: HTTP_STATUS_OK,
        statusText: 'OK',
        text: async () => '{}',
        json: async () => ({}),
        headers: new Headers(),
      } as Response;
    }) as unknown as typeof fetch;
    await httpRequest({
      url: 'https://api.test/a',
      method: 'POST',
      body: new URLSearchParams({ a: '1' }),
      fetchImpl: f,
    });
    const h = new Headers(seenHeaders);
    // Let the runtime / URLSearchParams dictate the actual Content-Type when
    // building the Request; the primitive MUST NOT guess application/json.
    expect(h.get('Content-Type')).toBeNull();
  });

  it('passes a pre-serialized string body through without double-stringifying', async () => {
    let seenBody: BodyInit | null | undefined;
    const f = vi.fn(async (_url: RequestInfo | URL, init: RequestInit = {}) => {
      seenBody = init.body;
      return {
        ok: true,
        status: HTTP_STATUS_OK,
        statusText: 'OK',
        text: async () => '{}',
        json: async () => ({}),
        headers: new Headers(),
      } as Response;
    }) as unknown as typeof fetch;
    await httpRequest({
      url: 'https://api.test/a',
      method: 'POST',
      body: '{"already":"json"}',
      fetchImpl: f,
    });
    expect(seenBody).toBe('{"already":"json"}');
  });

  it('passes a URLSearchParams body through untouched', async () => {
    let seenBody: BodyInit | null | undefined;
    const f = vi.fn(async (_url: RequestInfo | URL, init: RequestInit = {}) => {
      seenBody = init.body;
      return {
        ok: true,
        status: HTTP_STATUS_OK,
        statusText: 'OK',
        text: async () => '{}',
        json: async () => ({}),
        headers: new Headers(),
      } as Response;
    }) as unknown as typeof fetch;
    const form = new URLSearchParams({ a: '1', b: '2' });
    await httpRequest({
      url: 'https://api.test/a',
      method: 'POST',
      body: form,
      fetchImpl: f,
    });
    expect(seenBody).toBe(form);
  });

  it('gives applyAuthHeaders the string body for strings', async () => {
    const applyAuthHeaders = vi.fn(async (_url, headers) => headers);
    const f = mockFetch({ status: HTTP_STATUS_OK, json: async () => ({}) });
    await httpRequest({
      url: 'https://api.test/a',
      method: 'POST',
      body: 'raw-string',
      fetchImpl: f,
      applyAuthHeaders,
    });
    expect(applyAuthHeaders.mock.calls[0]![2]).toBe('raw-string');
  });
});

describe('httpRequest no-content response handling', () => {
  const HTTP_STATUS_OK = 200;
  const HTTP_STATUS_NO_CONTENT = 204;
  const HTTP_STATUS_RESET_CONTENT = 205;
  const HTTP_STATUS_NOT_MODIFIED = 304;

  const makeEmptyJsonFetch = (status: number): typeof fetch =>
    vi.fn(async () => ({
      ok: status >= 200 && status < 300,
      status,
      statusText: 'No Content',
      text: async () => '',
      json: async () => {
        throw new SyntaxError('Unexpected end of JSON input');
      },
      headers: new Headers(),
    })) as unknown as typeof fetch;

  it('returns undefined on 204 No Content', async () => {
    const result = await httpRequest({
      url: 'https://api.test/a',
      fetchImpl: makeEmptyJsonFetch(HTTP_STATUS_NO_CONTENT),
    });
    expect(result).toBeUndefined();
  });

  it('returns undefined on 205 Reset Content', async () => {
    const result = await httpRequest({
      url: 'https://api.test/a',
      fetchImpl: makeEmptyJsonFetch(HTTP_STATUS_RESET_CONTENT),
    });
    expect(result).toBeUndefined();
  });

  it('returns undefined on 304 Not Modified', async () => {
    const result = await httpRequest({
      url: 'https://api.test/a',
      fetchImpl: makeEmptyJsonFetch(HTTP_STATUS_NOT_MODIFIED),
    });
    expect(result).toBeUndefined();
  });

  it('returns undefined on 304 regardless of returnType (TEXT)', async () => {
    const f = vi.fn(async () => ({
      ok: true,
      status: HTTP_STATUS_NOT_MODIFIED,
      statusText: 'Not Modified',
      text: async () => '',
      json: async () => ({}),
      blob: async () => new Blob(),
      headers: new Headers(),
    })) as unknown as typeof fetch;
    const result = await httpRequest({
      url: 'https://api.test/a',
      returnType: 'TEXT',
      fetchImpl: f,
    });
    expect(result).toBeUndefined();
  });

  it('returns undefined on 304 regardless of returnType (BLOB)', async () => {
    const f = vi.fn(async () => ({
      ok: true,
      status: HTTP_STATUS_NOT_MODIFIED,
      statusText: 'Not Modified',
      text: async () => '',
      json: async () => ({}),
      blob: async () => new Blob(),
      headers: new Headers(),
    })) as unknown as typeof fetch;
    const result = await httpRequest({
      url: 'https://api.test/a',
      returnType: 'BLOB',
      fetchImpl: f,
    });
    expect(result).toBeUndefined();
  });

  it('returns undefined when a 200 response has an empty body', async () => {
    const f = vi.fn(async () => ({
      ok: true,
      status: HTTP_STATUS_OK,
      statusText: 'OK',
      text: async () => '',
      json: async () => ({}),
      headers: new Headers(),
    })) as unknown as typeof fetch;
    const result = await httpRequest({ url: 'https://api.test/a', fetchImpl: f });
    expect(result).toBeUndefined();
  });
});

describe('httpRequest abort semantics', () => {
  it('propagates a caller-supplied AbortSignal and tags the error non-transient', async () => {
    const controller = new AbortController();
    const f = vi.fn(
      (_u: RequestInfo | URL, init: RequestInit = {}) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'));
          });
        }),
    ) as unknown as typeof fetch;

    const pending = httpRequest({
      url: 'https://api.test/a',
      fetchImpl: f,
      otherArgs: { signal: controller.signal },
      timeout: 10_000,
    });
    controller.abort();

    await expect(pending).rejects.toMatchObject({
      name: 'HttpRequestError',
      isTransient: false,
      message: expect.stringContaining('aborted by caller'),
    });
  });

  it('attributes the abort to the caller when caller and timeout race', async () => {
    // Both signals fire before the fetch settles. We prefer the caller's
    // cancellation: retrying a request the caller asked us to stop is worse
    // than missing a "timed out" label.
    const callerController = new AbortController();
    const f = vi.fn(async () => {
      callerController.abort();
      throw new DOMException('aborted', 'AbortError');
    }) as unknown as typeof fetch;

    // Timer that also fires synchronously — models a deadline that elapses
    // at the same instant the caller cancels.
    const timer = {
      setTimeout: (fn: () => void) => {
        fn();
        return 0 as unknown as ReturnType<typeof setTimeout>;
      },
      clearTimeout: () => undefined,
    };

    await expect(
      httpRequest({
        url: 'https://api.test/a',
        fetchImpl: f,
        timer,
        timeout: 1,
        otherArgs: { signal: callerController.signal },
      }),
    ).rejects.toMatchObject({
      name: 'HttpRequestError',
      isTransient: false,
      message: expect.stringContaining('aborted by caller'),
    });
  });

  it('tags timeout aborts as transient with a timeout message', async () => {
    const f = vi.fn(async (_u: RequestInfo | URL, init: RequestInit = {}) => {
      // Await microtask so the timer callback runs and aborts the signal.
      await Promise.resolve();
      if (init.signal?.aborted) throw new DOMException('aborted', 'AbortError');
      throw new Error('test setup: expected timeout to fire before fetch completed');
    }) as unknown as typeof fetch;

    // Custom timer: fire the timeout callback immediately (before the fetch
    // promise resolves).
    const timer = {
      setTimeout: (fn: () => void) => {
        fn();
        return 0 as unknown as ReturnType<typeof setTimeout>;
      },
      clearTimeout: () => undefined,
    };

    await expect(
      httpRequest({ url: 'https://api.test/a', fetchImpl: f, timer, timeout: 1 }),
    ).rejects.toMatchObject({
      name: 'HttpRequestError',
      isTransient: true,
      message: expect.stringContaining('timed out'),
    });
  });
});
