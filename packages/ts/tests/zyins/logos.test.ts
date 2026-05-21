/**
 * `isa.zyins.logos.get` — covers the dataUri / Blob branch, the 404 error
 * funnel, the carrier path-encoding, and the missing-carrier guard.
 */

import { describe, expect, it } from 'vitest';
import { Isa } from '../../src/zyins/isa';
import type { LogosFetch, LogosGetOptions, LogosResponse } from '../../src/zyins/logos';
import { ZyInsError } from '../../src/zyins/errors';

// Fake bearer token used only in tests; not a real credential.
const FAKE_BEARER = ['isa', 'test', 'fixture-token-value'].join('_');
const TEST_BASE_URL = 'https://test.example';
const emptyEnv = () => undefined;

interface StubCall {
  url: string;
}

/** Create a deterministic logos fetch stub and capture requested URLs. */
function stubFetch(response: Partial<LogosResponse>): {
  fetchImpl: LogosFetch;
  calls: StubCall[];
} {
  const calls: StubCall[] = [];
  const fetchImpl: LogosFetch = async (url) => {
    calls.push({ url });
    return {
      status: response.status ?? 200,
      text: response.text ?? (async () => ''),
      blob: response.blob ?? (async () => new Blob([])),
    };
  };
  return { fetchImpl, calls };
}

/** Build the public Isa facade with a test base URL and logos fetcher. */
function buildIsa(fetchImpl: LogosFetch): Isa {
  return Isa.withBearer(
    { token: FAKE_BEARER },
    emptyEnv,
    { baseUrl: TEST_BASE_URL, logosFetch: fetchImpl },
  );
}

describe('isa.zyins.logos.get', () => {
  it('returns a data: URI string when dataUri=true', async () => {
    const { fetchImpl, calls } = stubFetch({
      status: 200,
      text: async () => 'data:image/png;base64,AAAA',
    });
    const result = await buildIsa(fetchImpl).zyins.logos.get('mountain-life', { dataUri: true });
    expect(typeof result).toBe('string');
    expect(result.startsWith('data:image/')).toBe(true);
    expect(calls[0]!.url).toBe(`${TEST_BASE_URL}/v1/logos/mountain-life?ds=true`);
  });

  it('returns a Blob when dataUri is omitted', async () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // PNG magic
    const { fetchImpl, calls } = stubFetch({
      status: 200,
      blob: async () => new Blob([bytes], { type: 'image/png' }),
    });
    const result = await buildIsa(fetchImpl).zyins.logos.get('mountain-life');
    expect(result).toBeInstanceOf(Blob);
    expect(calls[0]!.url).toBe(`${TEST_BASE_URL}/v1/logos/mountain-life`);
  });

  it('returns a Blob when dataUri=false', async () => {
    const { fetchImpl } = stubFetch({
      status: 200,
      blob: async () => new Blob([new Uint8Array([1, 2, 3])]),
    });
    const result = await buildIsa(fetchImpl).zyins.logos.get('mountain-life', { dataUri: false });
    expect(result).toBeInstanceOf(Blob);
  });

  it('returns the correct shape when dataUri is passed through typed options', async () => {
    const options: LogosGetOptions = { dataUri: true };
    const { fetchImpl } = stubFetch({
      status: 200,
      text: async () => 'data:image/png;base64,AAAA',
    });
    const result = await buildIsa(fetchImpl).zyins.logos.get('mountain-life', options);
    expect(result).toBe('data:image/png;base64,AAAA');
  });

  it('URI-encodes the carrier path segment', async () => {
    const { fetchImpl, calls } = stubFetch({
      status: 200,
      blob: async () => new Blob([]),
    });
    await buildIsa(fetchImpl).zyins.logos.get('acme insurance/co');
    expect(calls[0]!.url).toBe(`${TEST_BASE_URL}/v1/logos/acme%20insurance%2Fco`);
  });

  it('throws a typed ZyInsError on 404', async () => {
    const problem = JSON.stringify({
      type: 'about:blank',
      title: 'not found',
      status: 404,
      code: 'not_found',
    });
    const { fetchImpl } = stubFetch({
      status: 404,
      text: async () => problem,
    });
    await expect(buildIsa(fetchImpl).zyins.logos.get('does-not-exist')).rejects.toBeInstanceOf(
      ZyInsError,
    );
  });

  it('throws when carrier is empty', async () => {
    const { fetchImpl } = stubFetch({ status: 200, text: async () => '' });
    await expect(buildIsa(fetchImpl).zyins.logos.get('')).rejects.toBeInstanceOf(ZyInsError);
  });

  it('throws when carrier is blank after trimming', async () => {
    const { fetchImpl, calls } = stubFetch({ status: 200, text: async () => '' });
    await expect(buildIsa(fetchImpl).zyins.logos.get('   ')).rejects.toBeInstanceOf(ZyInsError);
    expect(calls).toHaveLength(0);
  });

  it('throws when dataUri=true response is not a data: URI', async () => {
    const { fetchImpl } = stubFetch({
      status: 200,
      text: async () => '<html>not a uri</html>',
    });
    await expect(
      buildIsa(fetchImpl).zyins.logos.get('mountain-life', { dataUri: true }),
    ).rejects.toBeInstanceOf(ZyInsError);
  });
});
