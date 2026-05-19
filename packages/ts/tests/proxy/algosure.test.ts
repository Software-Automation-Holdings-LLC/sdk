import { describe, expect, it, vi } from 'vitest';
import {
  ALGOSURE_TIME_BUCKET_MS,
  buildAlgosureHeaders,
  computeAlgosureHMAC,
  deriveSimpleKey,
} from '../../src/proxy/algosure/hmac';

const FIXED_TIME = 1_700_000_000_000;
const SALT = 'abcdefghijklmnopqrstuvwxyz0123456789';

function mockFetchSalt(salt: string): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: true,
    text: async () => salt,
  }) as unknown as typeof fetch;
}

describe('deriveSimpleKey', () => {
  it('produces a stable key for the same bucket', () => {
    const k1 = deriveSimpleKey(SALT, FIXED_TIME);
    const k2 = deriveSimpleKey(SALT, FIXED_TIME + 1_000);
    expect(k1).toBe(k2);
  });

  it('rotates the key at the next time bucket', () => {
    const k1 = deriveSimpleKey(SALT, FIXED_TIME);
    const k2 = deriveSimpleKey(SALT, FIXED_TIME + ALGOSURE_TIME_BUCKET_MS);
    expect(k1).not.toBe(k2);
  });

  it('returns at least 8 characters', () => {
    const k = deriveSimpleKey(SALT, FIXED_TIME);
    expect(k.length).toBeGreaterThanOrEqual(8);
  });
});

describe('computeAlgosureHMAC', () => {
  it('returns a 64-char hex tag and the supplied timestamp', async () => {
    const [tag, ts] = await computeAlgosureHMAC({
      host: 'example.com',
      method: 'POST',
      path: '/v1/call',
      body: { x: 1 },
      sessionId: 'sess-123',
      time: FIXED_TIME,
      fetchImpl: mockFetchSalt(SALT),
    });
    expect(tag).toMatch(/^[0-9a-f]{64}$/);
    expect(ts).toBe(FIXED_TIME);
  });

  it('produces the same tag for identical inputs (round-trip)', async () => {
    const args = {
      host: 'example.com',
      method: 'POST',
      path: '/v1/call',
      body: 'hello',
      sessionId: 'sess-123',
      time: FIXED_TIME,
      fetchImpl: mockFetchSalt(SALT),
    };
    const [tag1] = await computeAlgosureHMAC(args);
    const [tag2] = await computeAlgosureHMAC(args);
    expect(tag1).toBe(tag2);
  });

  it('produces different tags for different bodies', async () => {
    const base = {
      host: 'example.com',
      method: 'POST',
      path: '/v1/call',
      sessionId: 'sess-123',
      time: FIXED_TIME,
      fetchImpl: mockFetchSalt(SALT),
    };
    const [a] = await computeAlgosureHMAC({ ...base, body: 'a' });
    const [b] = await computeAlgosureHMAC({ ...base, body: 'b' });
    expect(a).not.toBe(b);
  });

  it('uses the injected clock when time is omitted', async () => {
    const clock = vi.fn(() => FIXED_TIME);
    const [, ts] = await computeAlgosureHMAC({
      host: 'example.com',
      method: 'POST',
      path: '/v1/call',
      body: '',
      sessionId: 'sess-123',
      clock,
      fetchImpl: mockFetchSalt(SALT),
    });
    expect(ts).toBe(FIXED_TIME);
    expect(clock).toHaveBeenCalledOnce();
  });

  it('throws when the salt is empty', async () => {
    await expect(
      computeAlgosureHMAC({
        host: 'example.com',
        method: 'POST',
        path: '/v1/call',
        body: '',
        sessionId: 's',
        time: FIXED_TIME,
        fetchImpl: mockFetchSalt(''),
      }),
    ).rejects.toThrow(/empty salt/);
  });

  it('throws when the salt fetch fails', async () => {
    const f = vi.fn().mockResolvedValue({ ok: false, status: 502, text: async () => '' }) as unknown as typeof fetch;
    await expect(
      computeAlgosureHMAC({
        host: 'example.com',
        method: 'POST',
        path: '/v1/call',
        body: '',
        sessionId: 's',
        time: FIXED_TIME,
        fetchImpl: f,
      }),
    ).rejects.toThrow(/salt fetch failed/);
  });
});

describe('computeAlgosureHMAC tamper detection', () => {
  const base = {
    host: 'example.com',
    method: 'POST',
    path: '/v1/call',
    sessionId: 'sess-123',
    time: FIXED_TIME,
    body: 'payload',
    fetchImpl: mockFetchSalt(SALT),
  };

  it('rejects tampered session id (signature changes)', async () => {
    const [a] = await computeAlgosureHMAC({ ...base });
    const [b] = await computeAlgosureHMAC({ ...base, sessionId: 'other' });
    expect(a).not.toBe(b);
  });

  it('rejects tampered method (signature changes)', async () => {
    const [a] = await computeAlgosureHMAC({ ...base });
    const [b] = await computeAlgosureHMAC({ ...base, method: 'GET' });
    expect(a).not.toBe(b);
  });

  it('rejects tampered salt (signature changes)', async () => {
    const [a] = await computeAlgosureHMAC({ ...base, fetchImpl: mockFetchSalt(SALT) });
    const [b] = await computeAlgosureHMAC({
      ...base,
      fetchImpl: mockFetchSalt('zyxwvutsrqponmlkjihgfedcba9876543210'),
    });
    expect(a).not.toBe(b);
  });
});

describe('computeAlgosureHMAC salt-proxy timeout', () => {
  const SALT_TIMEOUT_MS = 20;
  const HANG_DELAY_MS = 200;

  it('aborts the salt fetch when saltTimeout elapses', async () => {
    const hangingFetch = vi.fn((_url: RequestInfo | URL, init: RequestInit = {}) => {
      return new Promise<Response>((_resolve, reject) => {
        const signal = init.signal as AbortSignal | undefined;
        const handle = setTimeout(() => reject(new Error('fetch did not abort')), HANG_DELAY_MS);
        if (signal) {
          signal.addEventListener('abort', () => {
            clearTimeout(handle);
            reject(new DOMException('aborted', 'AbortError'));
          });
        }
      });
    }) as unknown as typeof fetch;

    await expect(
      computeAlgosureHMAC({
        host: 'example.com',
        method: 'POST',
        path: '/v1/call',
        sessionId: 'sess-123',
        time: FIXED_TIME,
        body: '',
        fetchImpl: hangingFetch,
        saltTimeout: SALT_TIMEOUT_MS,
      }),
    ).rejects.toThrow();
  });
});

describe('buildAlgosureHeaders', () => {
  it('emits all four required headers', async () => {
    const headers = await buildAlgosureHeaders({
      host: 'example.com',
      method: 'POST',
      path: '/v1/call',
      body: '',
      sessionId: 'sess-123',
      time: FIXED_TIME,
      fetchImpl: mockFetchSalt(SALT),
    });
    expect(headers.Authorization).toMatch(/^[0-9a-f]{64}$/);
    expect(headers['*Host']).toBe('example.com');
    expect(headers['*Timestamp']).toBe(String(FIXED_TIME));
    expect(headers['*sessionId']).toBe('sess-123');
  });
});
