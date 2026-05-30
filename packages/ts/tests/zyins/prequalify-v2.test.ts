/**
 * Contract tests for `ZyInsClient.prequalifyV2` and the typed value
 * objects returned from `POST /v2/prequalify`.
 *
 * Response fixtures mirror the OpenAPI examples in
 * `shared/schemas/gen/openapi/openapi-public.yaml`; request headers cover
 * SDK-owned signing and idempotency behavior.
 */
import { describe, expect, it } from 'vitest';
import { ZyInsClient } from '../../src/zyins/client';
import type { Transport, TransportRequest } from '../../src/zyins/transport';
import {
  TEST_APPLICANT,
  TEST_AUTH,
  TEST_COVERAGE,
  TEST_PRODUCTS,
  FIXED_CLOCK,
} from './fixtures';

interface CapturedCall {
  request: TransportRequest;
}

function recordingTransport(response: { status: number; body: string }): {
  transport: Transport;
  calls: CapturedCall[];
} {
  const calls: CapturedCall[] = [];
  const transport: Transport = async (request) => {
    calls.push({ request });
    return { status: response.status, body: response.body, headers: {} };
  };
  return { transport, calls };
}

/**
 * Read a top-level field from a serialized JSON wire body without
 * assuming a typed shape. Returns `undefined` when the body is not an
 * object or the key is missing — keeps the trust boundary explicit.
 */
function readWireField(body: string, key: string): unknown {
  const parsed: unknown = JSON.parse(body);
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return undefined;
  }
  return (parsed as { [k: string]: unknown })[key];
}

const QUALIFYING_BODY = JSON.stringify({
  object: 'prequalify_result',
  request_id: 'req_01HZK2N5GQR9T8X4B6FJW3Y1AS',
  idempotency_key: '550e8400-e29b-41d4-a716-446655440000',
  livemode: true,
  data: {
    plans: [
      {
        object: 'plan_offer',
        id: '9b7d9b5c-1f3a-5c2b-9a4f-6e1c2d3b4a5e',
        result_index: 39,
        rank: 8,
        eligibility: {
          eligible: true,
          category: 'graded',
          coverage_tier: 'graded',
          reasons: [],
        },
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
        plan_info: [
          {
            key: 'eapp',
            label: 'eApp',
            values: ['https://www.insuranceapplication.com/'],
          },
          {
            key: 'telesales',
            label: 'Telesales',
            values: ['Required in all written states'],
          },
        ],
        plan_info_legacy: {
          eapp: ['https://www.insuranceapplication.com/'],
          telesales: ['Required in all written states'],
        },
        death_benefit: { cents: 1500000, display: '$15,000.00' },
        premium: {
          cents: 12240,
          display: '$122.40',
          mode: 'MONTHLY-EFT',
          rate_class: 'graded',
          modes: {
            'MONTHLY-EFT': { cents: 12240, display: '$122.40' },
            ANNUAL: { cents: 138000, display: '$1380.00' },
          },
        },
        other_offers: [
          {
            rank: 10,
            eligibility: {
              eligible: true,
              category: 'rop',
              coverage_tier: 'rop',
              reasons: [],
            },
            premium: {
              cents: 14309,
              display: '$143.09',
              mode: 'MONTHLY-EFT',
              rate_class: 'rop',
              modes: {
                'MONTHLY-EFT': { cents: 14309, display: '$143.09' },
              },
            },
          },
        ],
        metadata: {},
      },
    ],
    has_more: false,
    next_cursor: null,
  },
});

describe('ZyInsClient.prequalifyV2', () => {
  it('hits POST /v2/prequalify with License HMAC headers', async () => {
    const { transport, calls } = recordingTransport({
      status: 200,
      body: QUALIFYING_BODY,
    });
    const client = new ZyInsClient({
      auth: TEST_AUTH,
      baseUrl: 'https://test.example',
      transport,
      clock: FIXED_CLOCK,
    });
    const result = await client.prequalifyV2({
      applicant: TEST_APPLICANT,
      coverage: TEST_COVERAGE,
      products: TEST_PRODUCTS,
    });

    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    expect(call.request.url).toBe('https://test.example/v2/prequalify');
    expect(call.request.method).toBe('POST');
    expect(call.request.headers['Authorization']).toMatch(/^License /);
    expect(call.request.headers['Content-Type']).toBe('application/json');
    expect(call.request.headers['Idempotency-Key']).toMatch(/^[0-9a-f]{64}$/);

    expect(result.requestId).toBe('req_01HZK2N5GQR9T8X4B6FJW3Y1AS');
    expect(result.idempotencyKey).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(result.livemode).toBe(true);
    expect(result.has_more).toBe(false);
    expect(result.next_cursor).toBeNull();
    expect(result.plans).toHaveLength(1);
  });

  it('defaults missing livemode to live responses', async () => {
    const body = JSON.stringify({
      object: 'prequalify_result',
      request_id: 'req_01HZK2N5GQR9T8X4B6FJW3Y1AS',
      data: {
        plans: [],
        has_more: false,
      },
    });
    const { transport } = recordingTransport({ status: 200, body });
    const client = new ZyInsClient({
      auth: TEST_AUTH,
      baseUrl: 'https://test.example',
      transport,
      clock: FIXED_CLOCK,
    });

    const result = await client.prequalifyV2({
      applicant: TEST_APPLICANT,
      coverage: TEST_COVERAGE,
      products: TEST_PRODUCTS,
    });

    expect(result.livemode).toBe(true);
  });

  it('parses qualifying offers with full premium grid and other_offers[]', async () => {
    const { transport } = recordingTransport({ status: 200, body: QUALIFYING_BODY });
    const client = new ZyInsClient({
      auth: TEST_AUTH,
      baseUrl: 'https://test.example',
      transport,
      clock: FIXED_CLOCK,
    });
    const result = await client.prequalifyV2({
      applicant: TEST_APPLICANT,
      coverage: TEST_COVERAGE,
      products: TEST_PRODUCTS,
    });

    const offer = result.plans[0]!;
    expect(offer.object).toBe('plan_offer');
    expect(offer.rank).toBe(8);
    expect(offer.result_index).toBe(39);
    expect(offer.eligibility.eligible).toBe(true);
    expect(offer.eligibility.category).toBe('graded');
    expect(offer.eligibility.coverage_tier).toBe('graded');
    expect(offer.eligibility.reasons).toEqual([]);

    expect(offer.carrier.name).toBe('American Amicable');
    expect(offer.product.slug).toBe('american-amicable-golden-solution');
    expect(offer.product.type).toBe('fex');
    expect(offer.death_benefit.cents).toBe(1500000);
    expect(offer.death_benefit.display).toBe('$15,000.00');

    expect(offer.premium).not.toBeNull();
    expect(offer.premium!.cents).toBe(12240);
    expect(offer.premium!.mode).toBe('MONTHLY-EFT');
    expect(offer.premium!.rate_class).toBe('graded');
    expect(offer.premium!.modes['ANNUAL']).toEqual({ cents: 138000, display: '$1380.00' });

    expect(offer.plan_info).toEqual([
      {
        key: 'eapp',
        label: 'eApp',
        values: ['https://www.insuranceapplication.com/'],
      },
      {
        key: 'telesales',
        label: 'Telesales',
        values: ['Required in all written states'],
      },
    ]);
    expect(offer.plan_info_legacy).toEqual({
      eapp: ['https://www.insuranceapplication.com/'],
      telesales: ['Required in all written states'],
    });

    expect(offer.other_offers).toHaveLength(1);
    const alt = offer.other_offers[0]!;
    expect(alt.rank).toBe(10);
    expect(alt.eligibility.category).toBe('rop');
    expect(alt.premium!.cents).toBe(14309);
    expect(alt.premium!.rate_class).toBe('rop');
  });

  it('normalizes legacy plan_info maps during the migration window', async () => {
    const legacyBody = JSON.stringify({
      object: 'prequalify_result',
      request_id: 'req_01HZK2N5GQR9T8X4B6FJW3Y1AS',
      livemode: true,
      data: {
        plans: [
          {
            object: 'plan_offer',
            id: '9b7d9b5c-1f3a-5c2b-9a4f-6e1c2d3b4a5e',
            result_index: 0,
            rank: 1,
            eligibility: { eligible: true, category: 'immediate', coverage_tier: null, reasons: [] },
            carrier: { id: 'a', name: 'X', logo_url: '' },
            product: { id: 'b', slug: 'x', name: 'X', display_name: 'X', type: 'fex', wire_token: 'fex' },
            plan_info: {
              telesales: ['Required in all written states'],
            },
            death_benefit: { cents: 1000000, display: '$10,000.00' },
            premium: { cents: 5000, display: '$50.00', mode: 'MONTHLY', rate_class: 'default', modes: {} },
            other_offers: [],
            metadata: {},
          },
        ],
        has_more: false,
        next_cursor: null,
      },
    });
    const { transport } = recordingTransport({ status: 200, body: legacyBody });
    const client = new ZyInsClient({
      auth: TEST_AUTH,
      baseUrl: 'https://test.example',
      transport,
      clock: FIXED_CLOCK,
    });
    const result = await client.prequalifyV2({
      applicant: TEST_APPLICANT,
      coverage: TEST_COVERAGE,
      products: TEST_PRODUCTS,
    });

    expect(result.plans[0]!.plan_info).toEqual([
      {
        key: 'telesales',
        label: 'Telesales',
        values: ['Required in all written states'],
      },
    ]);
  });

  it('preserves wire plan_info_legacy maps during the migration window', async () => {
    const legacyBody = JSON.stringify({
      object: 'prequalify_result',
      request_id: 'req_01HZK2N5GQR9T8X4B6FJW3Y1AS',
      livemode: true,
      data: {
        plans: [
          {
            object: 'plan_offer',
            id: '9b7d9b5c-1f3a-5c2b-9a4f-6e1c2d3b4a5e',
            result_index: 0,
            rank: 1,
            eligibility: { eligible: true, category: 'immediate', coverage_tier: null, reasons: [] },
            carrier: { id: 'a', name: 'X', logo_url: '' },
            product: { id: 'b', slug: 'x', name: 'X', display_name: 'X', type: 'fex', wire_token: 'fex' },
            plan_info: [
              { key: 'eapp', label: 'eApp', values: ['https://example.com'] },
            ],
            plan_info_legacy: {
              eapp: ['https://example.com'],
              telesales: ['Required in all written states'],
            },
            death_benefit: { cents: 1000000, display: '$10,000.00' },
            premium: { cents: 5000, display: '$50.00', mode: 'MONTHLY', rate_class: 'default', modes: {} },
            other_offers: [],
            metadata: {},
          },
        ],
        has_more: false,
        next_cursor: null,
      },
    });
    const { transport } = recordingTransport({ status: 200, body: legacyBody });
    const client = new ZyInsClient({
      auth: TEST_AUTH,
      baseUrl: 'https://test.example',
      transport,
      clock: FIXED_CLOCK,
    });
    const result = await client.prequalifyV2({
      applicant: TEST_APPLICANT,
      coverage: TEST_COVERAGE,
      products: TEST_PRODUCTS,
    });

    const offer = result.plans[0]!;
    expect(offer.plan_info).toEqual([
      { key: 'eapp', label: 'eApp', values: ['https://example.com'] },
      {
        key: 'telesales',
        label: 'Telesales',
        values: ['Required in all written states'],
      },
    ]);
    expect(offer.plan_info_legacy).toEqual({
      eapp: ['https://example.com'],
      telesales: ['Required in all written states'],
    });
  });

  it('parses ineligible offers with null premium and rank when include_ineligible=true', async () => {
    const ineligibleBody = JSON.stringify({
      object: 'prequalify_result',
      request_id: 'req_01HZK2N5GQR9T8X4B6FJW3Y1AS',
      idempotency_key: '550e8400-e29b-41d4-a716-446655440000',
      livemode: true,
      data: {
        plans: [
          {
            object: 'plan_offer',
            id: '9b7d9b5c-1f3a-5c2b-9a4f-6e1c2d3b4a5e',
            result_index: 12,
            rank: null,
            eligibility: {
              eligible: false,
              category: null,
              coverage_tier: null,
              reasons: ['Applicant declined: medication conflict'],
            },
            carrier: { id: 'a', name: 'X', logo_url: 'https://x' },
            product: {
              id: 'b',
              slug: 'x',
              name: 'X',
              display_name: 'X',
              type: 'fex',
              wire_token: 'fex',
            },
            plan_info: [],
            death_benefit: { cents: 1500000, display: '$15,000.00' },
            premium: null,
            other_offers: [],
            metadata: {},
          },
        ],
        has_more: false,
        next_cursor: null,
      },
    });
    const { transport, calls } = recordingTransport({ status: 200, body: ineligibleBody });
    const client = new ZyInsClient({
      auth: TEST_AUTH,
      baseUrl: 'https://test.example',
      transport,
      clock: FIXED_CLOCK,
    });
    const result = await client.prequalifyV2({
      applicant: TEST_APPLICANT,
      coverage: TEST_COVERAGE,
      products: TEST_PRODUCTS,
      options: { includeIneligible: true },
    });

    expect(readWireField(calls[0]!.request.body, 'include_ineligible')).toBe(true);

    const offer = result.plans[0]!;
    expect(offer.eligibility.eligible).toBe(false);
    expect(offer.eligibility.category).toBeNull();
    expect(offer.eligibility.coverage_tier).toBeNull();
    expect(offer.eligibility.reasons).toEqual([
      'Applicant declined: medication conflict',
    ]);
    expect(offer.rank).toBeNull();
    expect(offer.premium).toBeNull();
    expect(offer.other_offers).toEqual([]);
  });

  it('handles empty other_offers and missing optional fields defensively', async () => {
    const minimalBody = JSON.stringify({
      object: 'prequalify_result',
      request_id: 'req_01HZK2N5GQR9T8X4B6FJW3Y1AS',
      livemode: true,
      data: {
        plans: [
          {
            object: 'plan_offer',
            id: '9b7d9b5c-1f3a-5c2b-9a4f-6e1c2d3b4a5e',
            result_index: 0,
            rank: 1,
            eligibility: { eligible: true, category: 'immediate', coverage_tier: null, reasons: [] },
            carrier: { id: 'a', name: 'X', logo_url: '' },
            product: { id: 'b', slug: 'x', name: 'X', display_name: 'X', type: 'fex', wire_token: 'fex' },
            plan_info: [],
            death_benefit: { cents: 1000000, display: '$10,000.00' },
            premium: { cents: 5000, display: '$50.00', mode: 'MONTHLY', rate_class: 'default', modes: {} },
            other_offers: [],
            metadata: {},
          },
        ],
        has_more: false,
        next_cursor: null,
      },
    });
    const { transport } = recordingTransport({ status: 200, body: minimalBody });
    const client = new ZyInsClient({
      auth: TEST_AUTH,
      baseUrl: 'https://test.example',
      transport,
      clock: FIXED_CLOCK,
    });
    const result = await client.prequalifyV2({
      applicant: TEST_APPLICANT,
      coverage: TEST_COVERAGE,
      products: TEST_PRODUCTS,
    });

    const offer = result.plans[0]!;
    expect(offer.other_offers).toEqual([]);
    expect(offer.eligibility.coverage_tier).toBeNull();
    expect(offer.premium!.modes).toEqual({});
    expect(offer.plan_info_legacy).toBeUndefined();
  });

  it('passes Idempotency-Key through verbatim and re-derives stable keys per logical request', async () => {
    const { transport: t1, calls: c1 } = recordingTransport({ status: 200, body: QUALIFYING_BODY });
    const client1 = new ZyInsClient({
      auth: TEST_AUTH,
      baseUrl: 'https://test.example',
      transport: t1,
      clock: FIXED_CLOCK,
    });
    await client1.prequalifyV2({
      applicant: TEST_APPLICANT,
      coverage: TEST_COVERAGE,
      products: TEST_PRODUCTS,
    });
    const { transport: t2, calls: c2 } = recordingTransport({ status: 200, body: QUALIFYING_BODY });
    const client2 = new ZyInsClient({
      auth: TEST_AUTH,
      baseUrl: 'https://test.example',
      transport: t2,
      clock: FIXED_CLOCK,
    });
    await client2.prequalifyV2({
      applicant: TEST_APPLICANT,
      coverage: TEST_COVERAGE,
      products: TEST_PRODUCTS,
    });
    expect(c1[0]!.request.headers['Idempotency-Key']).toBe(
      c2[0]!.request.headers['Idempotency-Key'],
    );
  });
});
