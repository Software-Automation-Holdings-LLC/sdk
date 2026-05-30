/**
 * Regression: `isa.zyins.quote` must route by the pinned quote version
 * instead of aliasing straight to the v3 callable. Aliasing made a
 * default (v2-pinned) client surface a confusing `isa.zyins.quoteV3
 * requires apiVersion 'v3'` error for a method the consumer reached as
 * `quote` — and only at call time, which is right, but with the wrong
 * method name. Fixed in buildQuoteCallable.
 */
import { describe, it, expect } from 'vitest';
import { Isa, IsaConfigError } from '../../src/zyins';
import type { Transport } from '../../src/transport';
import { TEST_APPLICANT, TEST_AUTH, TEST_COVERAGE, TEST_PRODUCTS } from './fixtures';

const QUOTE_REQUEST = {
  applicant: TEST_APPLICANT,
  coverage: TEST_COVERAGE,
  products: TEST_PRODUCTS,
} as const;

async function buildIsa(
  apiVersion?: { quote?: 'v1' | 'v2' | 'v3' },
  transport?: Transport,
): Promise<Isa> {
  const isa = await Isa.withKeycode(
    { keycode: TEST_AUTH.licenseKey, email: TEST_AUTH.email },
    { get: () => undefined },
    apiVersion === undefined ? {} : { apiVersion },
  );
  if (transport) {
    type Internal = { clientOnce: () => { transport: Transport } };
    const client = ((isa.zyins as unknown) as Internal).clientOnce();
    client.transport = transport;
  }
  return isa;
}

describe('isa.zyins.quote version routing', () => {
  it('does not throw at construction for a default-pinned client', async () => {
    await expect(buildIsa()).resolves.toBeDefined();
  });

  it('rejects a default-pinned quote call with a quote-named config error', async () => {
    const isa = await buildIsa();
    await expect(isa.zyins.quote(QUOTE_REQUEST)).rejects.toBeInstanceOf(IsaConfigError);
    await expect(isa.zyins.quote(QUOTE_REQUEST)).rejects.toThrow(
      /isa\.zyins\.quote requires apiVersion 'v3'/,
    );
  });

  it('does not leak the internal quoteV3 alias in the default-pinned error', async () => {
    const isa = await buildIsa();
    const err = await isa.zyins.quote(QUOTE_REQUEST).catch((e: unknown) => e);
    expect((err as Error).message).not.toContain('quoteV3');
  });

  it('reaches the transport when pinned to v3 (no config error)', async () => {
    let hit = '';
    const transport: Transport = async (req) => {
      hit = req.url;
      return {
        status: 200,
        body: JSON.stringify({
          object: 'quote_result',
          request_id: 'req_01HZK2N5GQR9T8X4B6FJW3Y1AS',
          idempotency_key: '550e8400-e29b-41d4-a716-446655440000',
          livemode: false,
          data: { offers: [], meta: { amounts: [], total_products: 0 } },
        }),
        headers: {},
      };
    };
    const isa = await buildIsa({ quote: 'v3' }, transport);
    await isa.zyins.quote(QUOTE_REQUEST).catch(() => undefined);
    expect(hit).toContain('/v3/quote');
  });
});
