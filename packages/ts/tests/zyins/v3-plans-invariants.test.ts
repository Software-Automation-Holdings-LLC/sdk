/**
 * Cross-language v3 parity invariants (TS arm).
 *
 * Two invariants must hold identically for prequalify AND quote across
 * every SDK language:
 *  - INVARIANT 1 — fail-fast on an absent `plans` key (wire-shape drift),
 *    while a present-but-empty `plans: []` is a valid no-offers result.
 *  - INVARIANT 2 — `byAmount` in budget mode skips an offer missing
 *    `budget` rather than mis-bucketing it under its death benefit.
 */
import { describe, expect, it } from 'vitest';
import { ZyInsClient } from '../../src/zyins/client';
import type { Transport } from '../../src/zyins/transport';
import { Coverage } from '../../src/zyins/coverage';
import { byAmount } from '../../src/zyins/prequalify-v3';
import type { V3Offer } from '../../src/zyins/prequalify-v3-types';
import { TEST_APPLICANT, TEST_AUTH, TEST_PRODUCTS, FIXED_CLOCK } from './fixtures';

function transportReturning(responseBody: string): Transport {
  return async () => ({ status: 200, body: responseBody, headers: {} });
}

function clientWith(transport: Transport): ZyInsClient {
  return new ZyInsClient({
    auth: TEST_AUTH,
    baseUrl: 'https://test.example',
    transport,
    clock: FIXED_CLOCK,
  });
}

const ENVELOPE_BASE = {
  request_id: 'req_01HZK2N5GQR9T8X4B6FJW3Y1AS',
  idempotency_key: '550e8400-e29b-41d4-a716-446655440000',
  livemode: true,
};

const ABSENT_PLANS = JSON.stringify({ ...ENVELOPE_BASE, data: { other_field: 'value' } });
const EMPTY_PLANS = JSON.stringify({ ...ENVELOPE_BASE, data: { plans: [] } });

const REQUEST = {
  applicant: TEST_APPLICANT,
  coverage: Coverage.faceValues([25_000]),
  products: TEST_PRODUCTS,
} as const;

describe('v3 absent-plans fail-fast (INVARIANT 1)', () => {
  it('prequalifyV3 throws on an absent plans key', async () => {
    const client = clientWith(transportReturning(ABSENT_PLANS));
    await expect(client.prequalifyV3(REQUEST)).rejects.toThrow(/missing plans field/);
  });

  it('quoteV3 throws on an absent plans key', async () => {
    const client = clientWith(transportReturning(ABSENT_PLANS));
    await expect(client.quoteV3(REQUEST)).rejects.toThrow(/missing plans field/);
  });

  it('prequalifyV3 returns an empty result for present-but-empty plans', async () => {
    const client = clientWith(transportReturning(EMPTY_PLANS));
    const result = await client.prequalifyV3(REQUEST);
    expect(result.plans).toEqual([]);
  });

  it('quoteV3 returns an empty result for present-but-empty plans', async () => {
    const client = clientWith(transportReturning(EMPTY_PLANS));
    const result = await client.quoteV3(REQUEST);
    expect(result.plans).toEqual([]);
  });
});

describe('byAmount budget-mode skip (INVARIANT 2)', () => {
  it('skips an offer missing budget rather than bucketing it under deathBenefit', () => {
    const money = (cents: number, period: 'monthly' | null) => ({
      amount: { cents, display: `$${(cents / 100).toFixed(2)}` },
      period,
    });
    const offerWithBudget = {
      object: 'plan_offer',
      id: 'offer_with_budget',
      eligible: true,
      carrier: { id: 'c1', name: 'Aetna', logoUrl: '' },
      product: { id: 'p1', slug: 's', name: 'n', displayName: 'd', type: 'fex', wireToken: 'fex' },
      planInfo: [],
      deathBenefit: money(2_500_000, null),
      budget: money(5_000, 'monthly'),
      pricing: [],
      metadata: {},
    } as unknown as V3Offer;
    const offerMissingBudget = {
      ...offerWithBudget,
      id: 'offer_missing_budget',
      deathBenefit: money(5_000_000, null),
      budget: undefined,
    } as unknown as V3Offer;

    const grouped = byAmount([offerWithBudget, offerMissingBudget]);
    expect([...grouped.keys()]).toEqual([5_000]);
    expect(grouped.get(5_000)).toHaveLength(1);
    expect(grouped.has(5_000_000)).toBe(false);
  });
});
