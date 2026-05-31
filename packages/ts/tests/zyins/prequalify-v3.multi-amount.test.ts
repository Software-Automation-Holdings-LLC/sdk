/**
 * Multi-amount `POST /v3/prequalify` — native `coverage.quote_options`
 * request + flat `plans[]` response with the v3 Money primitive.
 *
 * The server (zyins #400, Money cutover) answers every v3 request — single
 * and multi-amount alike — with one flat `plans[]` array. These tests pin
 * both directions:
 *  - the request body for a multi-amount probe carries
 *    `coverage.quote_options { quote_type, amounts }` (mirroring the
 *    `/v3/quote` block) and never `coverage.face_amount_cents`;
 *  - the SDK decodes the flat `plans[]` into typed offers whose
 *    `deathBenefit`/`budget` are `Money { amount: {cents, display}, period }`,
 *    and `byAmount` groups them client-side by the requested dimension.
 */
import { describe, expect, it } from 'vitest';
import { ZyInsClient } from '../../src/zyins/client';
import type { Transport, TransportRequest } from '../../src/zyins/transport';
import { Coverage } from '../../src/zyins/coverage';
import { byAmount } from '../../src/zyins/prequalify-v3';
import { TEST_APPLICANT, TEST_AUTH, TEST_PRODUCTS, FIXED_CLOCK } from './fixtures';

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function parseBody(raw: string | undefined): Record<string, unknown> {
  const parsed: unknown = JSON.parse(raw ?? '{}');
  if (!isRecord(parsed)) throw new Error('Expected request body to parse to an object');
  return parsed;
}

function transportReturning(
  responseBody: string,
): { transport: Transport; captured: { req?: TransportRequest } } {
  const captured: { req?: TransportRequest } = {};
  const transport: Transport = async (req) => {
    captured.req = req;
    return { status: 200, body: responseBody, headers: {} };
  };
  return { transport, captured };
}

function faceOffer(amountCents: number, display: string, premiumCents: number): unknown {
  return {
    object: 'plan_offer',
    id: '9b7d9b5c-1f3a-5c2b-9a4f-6e1c2d3b4a5e',
    eligible: true,
    carrier: { id: 'c1', name: 'Aetna', logo_url: '' },
    product: {
      id: 'p1',
      slug: 'aetna-accendo',
      name: 'Accendo',
      display_name: 'Aetna Accendo',
      type: 'fex',
      wire_token: 'fex',
    },
    plan_info: [],
    death_benefit: { amount: { cents: amountCents, display }, period: null },
    pricing: [
      {
        rate_class: 'Preferred',
        primary: true,
        eligibility: { category: 'immediate', eligible: true, reasons: [] },
        premium: {
          amount: { cents: premiumCents, display: `$${(premiumCents / 100).toFixed(2)}` },
          default_mode: 'MONTHLY-EFT',
          modes: {
            'MONTHLY-EFT': { cents: premiumCents, display: `$${(premiumCents / 100).toFixed(2)}` },
          },
        },
        rank: 1,
      },
    ],
    metadata: {},
  };
}

function budgetOffer(budgetCents: number, display: string, premiumCents: number): unknown {
  const base = faceOffer(5_000_000, '$50,000', premiumCents) as Record<string, unknown>;
  base['budget'] = { amount: { cents: budgetCents, display }, period: 'monthly' };
  return base;
}

const FLAT_FACE_RESPONSE = JSON.stringify({
  object: 'prequalify_result',
  request_id: 'req_01HZK2N5GQR9T8X4B6FJW3Y1AS',
  idempotency_key: '550e8400-e29b-41d4-a716-446655440000',
  livemode: true,
  data: {
    plans: [faceOffer(2_500_000, '$25,000', 4_500), faceOffer(5_000_000, '$50,000', 8_100)],
  },
});

const FLAT_BUDGET_RESPONSE = JSON.stringify({
  object: 'prequalify_result',
  request_id: 'req_01HZK2N5GQR9T8X4B6FJW3Y1AS',
  idempotency_key: '550e8400-e29b-41d4-a716-446655440000',
  livemode: true,
  data: {
    plans: [budgetOffer(5_000, '$50.00', 4_500), budgetOffer(7_500, '$75.00', 7_000)],
  },
});

const EMPTY_RESPONSE = JSON.stringify({
  object: 'prequalify_result',
  request_id: 'req_01HZK2N5GQR9T8X4B6FJW3Y1AS',
  idempotency_key: '550e8400-e29b-41d4-a716-446655440000',
  livemode: true,
  data: { plans: [] },
});

function clientWith(transport: Transport): ZyInsClient {
  return new ZyInsClient({
    auth: TEST_AUTH,
    baseUrl: 'https://test.example',
    transport,
    clock: FIXED_CLOCK,
  });
}

describe('prequalifyV3 multi-amount wire shape', () => {
  it('emits coverage.quote_options for a multi face-amount probe, never face_amount_cents', async () => {
    const { transport, captured } = transportReturning(FLAT_FACE_RESPONSE);
    await clientWith(transport).prequalifyV3({
      applicant: TEST_APPLICANT,
      coverage: Coverage.faceValues([25_000, 50_000]),
      products: TEST_PRODUCTS,
    });

    const coverage = parseBody(captured.req?.body)['coverage'];
    if (!isRecord(coverage)) throw new Error('coverage must be an object');
    expect(coverage).not.toHaveProperty('face_amount_cents');
    expect(coverage['state']).toBe('NC');
    expect(coverage['quote_options']).toEqual({
      quote_type: 'face_amounts',
      amounts: ['25000', '50000'],
    });
  });

  it('emits monthly_budget quote_type for a multi monthly-budget probe', async () => {
    const { transport, captured } = transportReturning(FLAT_BUDGET_RESPONSE);
    await clientWith(transport).prequalifyV3({
      applicant: TEST_APPLICANT,
      coverage: Coverage.monthlyBudgets([50, 75]),
      products: TEST_PRODUCTS,
    });

    const coverage = parseBody(captured.req?.body)['coverage'];
    if (!isRecord(coverage)) throw new Error('coverage must be an object');
    expect(coverage['quote_options']).toEqual({
      quote_type: 'monthly_budget',
      amounts: ['50', '75'],
    });
  });
});

describe('prequalifyV3 flat plans[] parsing', () => {
  it('decodes flat plans with Money-typed deathBenefit (period null)', async () => {
    const { transport } = transportReturning(FLAT_FACE_RESPONSE);
    const result = await clientWith(transport).prequalifyV3({
      applicant: TEST_APPLICANT,
      coverage: Coverage.faceValues([25_000, 50_000]),
      products: TEST_PRODUCTS,
    });

    expect(result.plans).toHaveLength(2);
    expect(result.plans[0]!.deathBenefit).toEqual({
      amount: { cents: 2_500_000, display: '$25,000' },
      period: null,
    });
    expect(result.plans[0]!.budget).toBeUndefined();
    expect(result.plans[1]!.pricing[0]!.premium?.amount.cents).toBe(8_100);
  });

  it('byAmount groups a face-amount response by deathBenefit.amount.cents', async () => {
    const { transport } = transportReturning(FLAT_FACE_RESPONSE);
    const result = await clientWith(transport).prequalifyV3({
      applicant: TEST_APPLICANT,
      coverage: Coverage.faceValues([25_000, 50_000]),
      products: TEST_PRODUCTS,
    });

    const grouped = byAmount(result.plans);
    expect([...grouped.keys()]).toEqual([2_500_000, 5_000_000]);
    expect(grouped.get(2_500_000)).toHaveLength(1);
    expect(grouped.get(5_000_000)).toHaveLength(1);
  });

  it('decodes budget (period monthly) and byAmount groups by budget.amount.cents', async () => {
    const { transport } = transportReturning(FLAT_BUDGET_RESPONSE);
    const result = await clientWith(transport).prequalifyV3({
      applicant: TEST_APPLICANT,
      coverage: Coverage.monthlyBudgets([50, 75]),
      products: TEST_PRODUCTS,
    });

    expect(result.plans[0]!.budget).toEqual({
      amount: { cents: 5_000, display: '$50.00' },
      period: 'monthly',
    });
    const grouped = byAmount(result.plans);
    expect([...grouped.keys()]).toEqual([5_000, 7_500]);
  });

  it('decodes an empty flat plans array', async () => {
    const { transport } = transportReturning(EMPTY_RESPONSE);
    const result = await clientWith(transport).prequalifyV3({
      applicant: TEST_APPLICANT,
      coverage: Coverage.faceValues([25_000]),
      products: TEST_PRODUCTS,
    });

    expect(result.plans).toEqual([]);
  });
});
