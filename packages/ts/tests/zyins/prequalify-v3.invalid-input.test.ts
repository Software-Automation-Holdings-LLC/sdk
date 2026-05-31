/**
 * Regression: v3 prequalify must reject underwriting input it cannot
 * faithfully represent rather than silently rewriting it.
 *
 *  - ProductSelection.byTypes carries a product-class dimension the v3
 *    prequalify envelope has no field for; the old serializer dropped it
 *    and sent products: [] (underwriting the wrong set).
 *  - A single monthly_budget coverage was sent as a face amount.
 *  - An unrecognized nicotine frequency was coerced to 'daily'.
 *
 * Each is a loud client-side throw. Multi-amount probes (face or budget)
 * are now serialized natively via `coverage.quote_options` — see
 * `prequalify-v3.multi-amount.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import { serializeV3PrequalifyBody } from '../../src/zyins/prequalify-v3';
import type { PrequalifyV3Request } from '../../src/zyins/prequalify-v3-types';
import { Coverage } from '../../src/zyins/coverage';
import { ProductSelection, ProductClass } from '../../src/zyins/product';
import { TEST_APPLICANT, TEST_COVERAGE, TEST_PRODUCTS } from './fixtures';

function requestWith(overrides: Partial<PrequalifyV3Request>): PrequalifyV3Request {
  return {
    applicant: TEST_APPLICANT,
    coverage: TEST_COVERAGE,
    products: TEST_PRODUCTS,
    ...overrides,
  };
}

describe('serializeV3PrequalifyBody — invalid input rejection', () => {
  it('rejects a byTypes selection instead of dropping it to products: []', () => {
    const request = requestWith({
      products: ProductSelection.byTypes([ProductClass.Term]),
    });
    expect(() => serializeV3PrequalifyBody(request)).toThrow(/byTypes is not supported on v3 prequalify/);
  });

  it('serializes an explicit (of) selection into a non-empty products[]', () => {
    const body = JSON.parse(serializeV3PrequalifyBody(requestWith({}))) as {
      products: string[];
    };
    expect(body.products.length).toBeGreaterThan(0);
  });

  it('serializes a single monthly_budget coverage to quote_options instead of throwing', () => {
    const request = requestWith({ coverage: Coverage.monthlyBudget(150) });
    const body = JSON.parse(serializeV3PrequalifyBody(request)) as {
      coverage: { quote_options?: { quote_type: string; amounts: string[] }; face_amount_cents?: number };
    };
    expect(body.coverage.face_amount_cents).toBeUndefined();
    expect(body.coverage.quote_options).toEqual({
      quote_type: 'monthly_budget',
      amounts: ['150'],
    });
  });

  it('rejects an unrecognized nicotine frequency rather than coercing to daily', () => {
    const request = requestWith({
      applicant: {
        ...TEST_APPLICANT,
        nicotineUse: {
          lastUsed: '0-12_months',
          productUsage: [{ type: 'cigarettes', frequency: 'twice_a_fortnight' }],
        },
      },
    });
    expect(() => serializeV3PrequalifyBody(request)).toThrow(/Unknown nicotine frequency/);
  });

  it('accepts a recognized nicotine frequency and maps it to the v3 enum', () => {
    const request = requestWith({
      applicant: {
        ...TEST_APPLICANT,
        nicotineUse: {
          lastUsed: '0-12_months',
          productUsage: [{ type: 'cigarettes', frequency: 'WEEKLY' }],
        },
      },
    });
    const body = JSON.parse(serializeV3PrequalifyBody(request)) as {
      applicant: { nicotine: { specificity: Array<{ frequency: string }> } };
    };
    expect(body.applicant.nicotine.specificity[0]?.frequency).toBe('few_times_per_week');
  });
});

describe('ProductSelection.byTypes (README example) on the v2/quote flat body', () => {
  it('emits include_product_class so the type selection survives', () => {
    const selection = ProductSelection.byTypes([ProductClass.Term]);
    expect(selection.toWireFields()).toEqual({ include_product_class: ['term'] });
  });
});
