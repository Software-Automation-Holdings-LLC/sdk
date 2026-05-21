import { describe, expect, it } from 'vitest';
import { client, recordingTransport } from './client-test-helpers';

describe('ZyInsClient.preferences.lookup', () => {
  it('GETs /v1/preferences and returns prefs', async () => {
    const body = JSON.stringify({ prefs: { theme: 'dark', density: 'compact' } });
    const { transport, requests } = recordingTransport(200, body);
    const result = await client(transport).preferences.lookup();
    expect(result.prefs).toEqual({ theme: 'dark', density: 'compact' });
    expect(requests[0]!.method).toBe('GET');
    expect(requests[0]!.url).toBe('https://test.example/v1/preferences');
  });

  it('accepts the ADR-012 enveloped shape', async () => {
    const body = JSON.stringify({ data: { prefs: { x: 1 } } });
    const { transport } = recordingTransport(200, body);
    const result = await client(transport).preferences.lookup();
    expect(result.prefs).toEqual({ x: 1 });
  });

  it('maps 401 to a typed error', async () => {
    const { transport } = recordingTransport(
      401,
      JSON.stringify({ type: 'about:blank', title: 'unauthorized', status: 401, code: 'unauthorized' }),
    );
    await expect(client(transport).preferences.lookup()).rejects.toBeInstanceOf(Error);
  });
});

describe('ZyInsClient.preferences.set', () => {
  it('POSTs /v1/preferences with the prefs body and an Idempotency-Key', async () => {
    const { transport, requests } = recordingTransport(200, JSON.stringify({ prefs: { a: 1 } }));
    const result = await client(transport).preferences.set({ prefs: { a: 1 } });
    expect(result.prefs).toEqual({ a: 1 });
    expect(requests[0]!.method).toBe('POST');
    expect(requests[0]!.url).toBe('https://test.example/v1/preferences');
    expect(requests[0]!.headers['Idempotency-Key']).toBeTruthy();
    const sent: unknown = JSON.parse(requests[0]!.body);
    expect(sent).toEqual({ prefs: { a: 1 } });
  });

  it('falls back to the request prefs on empty success body', async () => {
    const { transport } = recordingTransport(200, '');
    const result = await client(transport).preferences.set({ prefs: { theme: 'light' } });
    expect(result.prefs).toEqual({ theme: 'light' });
  });

  it('rejects missing prefs', async () => {
    const { transport } = recordingTransport(200, '{}');
    await expect(
      client(transport).preferences.set({} as unknown as { prefs: Record<string, unknown> }),
    ).rejects.toThrow(/prefs/);
  });

  it('rejects array prefs', async () => {
    const { transport } = recordingTransport(200, '{}');
    await expect(
      client(transport).preferences.set({ prefs: [] as unknown as Record<string, unknown> }),
    ).rejects.toThrow(/prefs/);
  });

  it('maps 400 to a typed error', async () => {
    const { transport } = recordingTransport(
      400,
      JSON.stringify({ type: 'about:blank', title: 'invalid', status: 400, code: 'validation_error' }),
    );
    await expect(client(transport).preferences.set({ prefs: {} })).rejects.toBeInstanceOf(Error);
  });
});
