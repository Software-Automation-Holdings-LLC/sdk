import { describe, expect, it } from 'vitest';
import { account, recordingTransport } from './helpers';

describe('isa.account.preferences.lookup', () => {
  it('GETs /v1/preferences with the scope query parameter', async () => {
    const body = JSON.stringify({ prefs: { theme: 'dark' } });
    const { transport, requests } = recordingTransport(200, body);
    const result = await account(transport).preferences.lookup({ scope: 'bpp' });
    expect(result.prefs).toEqual({ theme: 'dark' });
    expect(requests[0]!.method).toBe('GET');
    expect(requests[0]!.url).toBe('https://test.example/v1/preferences?scope=bpp');
    expect(requests[0]!.headers).toHaveProperty('X-Device-Signature');
  });

  it('accepts the enveloped shape', async () => {
    const body = JSON.stringify({ data: { prefs: { x: 1 } } });
    const { transport } = recordingTransport(200, body);
    const result = await account(transport).preferences.lookup({ scope: 'bpp' });
    expect(result.prefs).toEqual({ x: 1 });
  });

  it('rejects an empty scope', async () => {
    const { transport } = recordingTransport(200, '{}');
    await expect(
      // @ts-expect-error — runtime validation guard
      account(transport).preferences.lookup({ scope: '' }),
    ).rejects.toThrow(/scope/);
  });

  it('maps 401 to a typed error', async () => {
    const { transport } = recordingTransport(
      401,
      JSON.stringify({ type: 'about:blank', title: 'unauthorized', status: 401, code: 'unauthorized' }),
    );
    await expect(
      account(transport).preferences.lookup({ scope: 'bpp' }),
    ).rejects.toBeInstanceOf(Error);
  });
});

describe('isa.account.preferences.set', () => {
  it('POSTs /v1/preferences with scope + prefs and a derived Idempotency-Key', async () => {
    const { transport, requests } = recordingTransport(200, JSON.stringify({ ok: true }));
    const result = await account(transport).preferences.set({
      scope: 'bpp',
      prefs: { a: 1 },
    });
    expect(result).toEqual({ ok: true });
    expect(requests[0]!.method).toBe('POST');
    expect(requests[0]!.url).toBe('https://test.example/v1/preferences');
    expect(requests[0]!.headers['Idempotency-Key']).toBeTruthy();
    const sent: unknown = JSON.parse(requests[0]!.body);
    expect(sent).toEqual({ scope: 'bpp', prefs: { a: 1 } });
  });

  it('treats any 2xx as success', async () => {
    const { transport } = recordingTransport(204, '');
    const result = await account(transport).preferences.set({
      scope: 'bpp',
      prefs: { theme: 'light' },
    });
    expect(result).toEqual({ ok: true });
  });

  it('rejects missing prefs', async () => {
    const { transport } = recordingTransport(200, '{}');
    await expect(
      // @ts-expect-error — runtime validation guard
      account(transport).preferences.set({ scope: 'bpp' }),
    ).rejects.toThrow(/prefs/);
  });

  it('maps 400 to a typed error', async () => {
    const { transport } = recordingTransport(
      400,
      JSON.stringify({ type: 'about:blank', title: 'invalid', status: 400, code: 'validation_error' }),
    );
    await expect(
      account(transport).preferences.set({ scope: 'bpp', prefs: {} }),
    ).rejects.toBeInstanceOf(Error);
  });

  it('maps 500 to a typed error', async () => {
    const { transport } = recordingTransport(
      500,
      JSON.stringify({ type: 'about:blank', title: 'server error', status: 500, code: 'server_error' }),
    );
    await expect(
      account(transport).preferences.set({ scope: 'bpp', prefs: { a: 1 } }),
    ).rejects.toBeInstanceOf(Error);
  });
});
