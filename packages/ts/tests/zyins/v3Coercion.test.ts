/**
 * Unit contract for `coerceProduct` — the v3 offer `product` coercion.
 *
 * Regression guard for the bpp2.0 grouping bug: the wire carries
 * `product.plan_group` (term `20-year`, medsup `plan-g`) used to drive the
 * results grouping rail, but the coercion allowlist dropped it, so Term and
 * MedSup grouping silently never worked. These tests pin the field through
 * the coercion intact, and pin the absent case so an ungrouped product
 * (e.g. `fex`) still coerces cleanly.
 */

import { describe, expect, it } from 'vitest';
import { coerceProduct } from '../../src/zyins/v3Coercion';

describe('coerceProduct', () => {
  it('preserves a term offer plan_group and plan_group_label verbatim', () => {
    const product = coerceProduct({
      id: '2a1b3c4d-5e6f-5071-8293-a4b5c6d7e8f9',
      slug: 'banner-opterm',
      name: 'OPTerm',
      display_name: 'Banner OPTerm',
      type: 'term',
      wire_token: 'term',
      plan_group: '20-year',
      plan_group_label: '20 Year',
    });

    expect(product.plan_group).toBe('20-year');
    expect(product.plan_group_label).toBe('20 Year');
    // Base fields stay intact alongside the newly-preserved grouping keys.
    expect(product.type).toBe('term');
    expect(product.wire_token).toBe('term');
    expect(product.display_name).toBe('Banner OPTerm');
  });

  it('preserves a medsup offer plan_group', () => {
    const product = coerceProduct({
      id: '3b2c4d5e-6f70-5182-93a4-b5c6d7e8f9a0',
      slug: 'aetna-medicare-supplement',
      name: 'Medicare Supplement',
      display_name: 'Aetna Medicare Supplement',
      type: 'medsup',
      wire_token: 'medsup',
      plan_group: 'plan-g',
    });

    expect(product.plan_group).toBe('plan-g');
    // No label on the wire → absent, not an empty string.
    expect(product.plan_group_label).toBeUndefined();
  });

  it('coerces an offer without plan_group without breaking', () => {
    const product = coerceProduct({
      id: '1c2d3e4f-5a6b-5c7d-8e9f-0a1b2c3d4e5f',
      slug: 'american-amicable-golden-solution',
      name: 'Golden Solution',
      display_name: 'American Amicable Golden Solution',
      type: 'fex',
      wire_token: 'fex',
    });

    expect(product.plan_group).toBeUndefined();
    expect(product.plan_group_label).toBeUndefined();
    expect(product.slug).toBe('american-amicable-golden-solution');
    expect(product.type).toBe('fex');
  });

  it('ignores a non-string plan_group rather than poisoning the type', () => {
    const product = coerceProduct({
      id: '1c2d3e4f-5a6b-5c7d-8e9f-0a1b2c3d4e5f',
      slug: 'american-amicable-golden-solution',
      name: 'Golden Solution',
      display_name: 'American Amicable Golden Solution',
      type: 'fex',
      wire_token: 'fex',
      plan_group: null,
      plan_group_label: 42,
    });

    expect(product.plan_group).toBeUndefined();
    expect(product.plan_group_label).toBeUndefined();
  });
});
