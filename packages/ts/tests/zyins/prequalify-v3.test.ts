/**
 * Contract tests for `ZyInsClient.prequalifyV3` — the uniform
 * `pricing[]` shape, integer-cents money, no `result_index`, no
 * client-side merge of `premium` + `other_offers`.
 */
import { describe, expect, it } from 'vitest';
import { ZyInsClient } from '../../src/zyins/client';
import type { Transport } from '../../src/zyins/transport';
import {
  TEST_APPLICANT,
  TEST_AUTH,
  TEST_COVERAGE,
  TEST_PRODUCTS,
  FIXED_CLOCK,
} from './fixtures';

function transportWith(body: string): Transport {
  return async () => ({ status: 200, body, headers: {} });
}

const SAMPLE_V3_OFFER = {
  object: 'plan_offer',
  id: '9b7d9b5c-1f3a-5c2b-9a4f-6e1c2d3b4a5e',
  eligible: true,
  carrier: {
    id: '7a3e4b5c-6d7e-5f80-8a9b-0c1d2e3f4a5b',
    name: 'American Amicable',
    logo_url: 'https://zyins.isaapi.com/v1/logo/American%20Amicable',
  },
  product: {
    id: '1c2d3e4f-5a6b-5c7d-8e9f-0a1b2c3d4e5f',
    slug: 'american-amicable-golden-solution',
    name: 'Golden Solution',
    display_name: 'American Amicable Golden Solution',
    type: 'fex',
    wire_token: 'fex',
  },
  plan_info: [],
  death_benefit: { cents: 2500000, display: '$25,000.00' },
  pricing: [
    {
      rate_class: 'Preferred Plus',
      primary: true,
      eligibility: { category: 'immediate', eligible: true, reasons: [] },
      premium: {
        cents: 9122,
        display: '$91.22',
        default: { cents: 9122, display: '$91.22' },
        modes: { 'MONTHLY-EFT': { cents: 9122, display: '$91.22' } },
      },
      rank: 1,
    },
    {
      rate_class: 'Standard',
      primary: false,
      eligibility: { category: 'graded', eligible: false, reasons: ['underwriting'] },
      rank: null,
    },
  ],
  metadata: {},
};

describe('ZyInsClient.prequalifyV3', () => {
  it('parses the uniform pricing[] table — every row carries its own eligibility', async () => {
    const transport = transportWith(
      JSON.stringify({
        object: 'prequalify_result',
        request_id: 'req_01HZK2N5GQR9T8X4B6FJW3Y1AS',
        idempotency_key: '550e8400-e29b-41d4-a716-446655440000',
        livemode: true,
        data: { plans: [SAMPLE_V3_OFFER] },
      }),
    );
    const client = new ZyInsClient({
      auth: TEST_AUTH,
      baseUrl: 'https://test.example',
      transport,
      clock: FIXED_CLOCK,
    });
    const result = await client.prequalifyV3({
      applicant: TEST_APPLICANT,
      coverage: TEST_COVERAGE,
      products: TEST_PRODUCTS,
    });
    expect(result.plans).toHaveLength(1);
    const offer = result.plans[0]!;
    expect(offer.eligible).toBe(true);
    expect(offer.pricing).toHaveLength(2);

    const primary = offer.pricing[0]!;
    expect(primary.primary).toBe(true);
    expect(primary.rateClass).toBe('Preferred Plus');
    expect(primary.eligibility.eligible).toBe(true);
    expect(primary.eligibility.category).toBe('immediate');
    expect(primary.premium?.cents).toBe(9122);
    expect(primary.premium?.default).toEqual({ cents: 9122, display: '$91.22' });
    expect(primary.rank).toBe(1);

    const alt = offer.pricing[1]!;
    expect(alt.primary).toBe(false);
    expect(alt.eligibility.eligible).toBe(false);
    expect(alt.eligibility.reasons).toEqual(['underwriting']);
    expect(alt.premium).toBeUndefined();
    expect(alt.rank).toBeNull();
  });

  it('mints a UUID v4 Idempotency-Key and includes it in the request headers', async () => {
    let captured: Record<string, string> = {};
    const transport: Transport = async (req) => {
      captured = req.headers;
      return {
        status: 200,
        body: JSON.stringify({
          object: 'prequalify_result',
          request_id: 'req_01HZK2N5GQR9T8X4B6FJW3Y1AS',
          idempotency_key: captured['Idempotency-Key'] ?? '',
          livemode: true,
          data: { plans: [] },
        }),
        headers: {},
      };
    };
    const client = new ZyInsClient({
      auth: TEST_AUTH,
      baseUrl: 'https://test.example',
      transport,
      clock: FIXED_CLOCK,
    });
    const result = await client.prequalifyV3({
      applicant: TEST_APPLICANT,
      coverage: TEST_COVERAGE,
      products: TEST_PRODUCTS,
    });
    expect(captured['Idempotency-Key']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(result.idempotencyKey).toBe(captured['Idempotency-Key']);
  });
});
