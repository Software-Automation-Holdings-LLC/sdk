/**
 * Product catalog tests (v0.5.3 spec).
 *
 * Covers the nested-by-type `Products` namespace and the typed-only
 * `ProductSelection` factories.
 */

import { describe, expect, it } from 'vitest';
import {
  Products,
  ProductType,
  ProductSelection,
  type Product,
} from '../../src/zyins/product';

describe('Products catalog', () => {
  it('has at least one product in each type namespace', () => {
    expect(Object.keys(Products.Fex).length).toBeGreaterThan(0);
    expect(Object.keys(Products.Medsup).length).toBeGreaterThan(0);
    expect(Object.keys(Products.Preneed).length).toBeGreaterThan(0);
    expect(Object.keys(Products.Term).length).toBeGreaterThan(0);
  });

  it('every wire token is prefixed by its product type', () => {
    for (const p of Object.values(Products.Fex) as Product[]) {
      expect(p.wireToken.startsWith('fex-')).toBe(true);
    }
    for (const p of Object.values(Products.Medsup) as Product[]) {
      expect(p.wireToken.startsWith('medsup-')).toBe(true);
    }
    for (const p of Object.values(Products.Preneed) as Product[]) {
      expect(p.wireToken.startsWith('preneed-')).toBe(true);
    }
    for (const p of Object.values(Products.Term) as Product[]) {
      expect(p.wireToken.startsWith('term-')).toBe(true);
    }
  });

  it('byWireToken roundtrips against the flat catalog', () => {
    for (const p of Products.all()) {
      expect(Products.byWireToken(p.wireToken)?.wireToken).toBe(p.wireToken);
    }
    expect(Products.byWireToken('not-a-real-token')).toBeUndefined();
  });

  it('byLegacy is case-insensitive on display name within a type', () => {
    const accendo = Products.Fex['AetnaAccendo'] as Product;
    const found = Products.byLegacy(ProductType.FinalExpense, accendo.displayName.toLowerCase());
    expect(found?.wireToken).toBe(accendo.wireToken);
    expect(
      Products.byLegacy(ProductType.Term, accendo.displayName),
    ).toBeUndefined();
  });
});

describe('ProductSelection factories', () => {
  it('of() emits products[] in toWireFields()', () => {
    const accendo = Products.Fex['AetnaAccendo'] as Product;
    const sel = ProductSelection.of([accendo]);
    expect(sel.toWireFields()).toEqual({ products: [accendo.wireToken] });
  });

  it('byTypes() emits include_product_class[]', () => {
    const sel = ProductSelection.byTypes([ProductType.FinalExpense, ProductType.Term]);
    expect(sel.toWireFields()).toEqual({
      include_product_class: ['fex', 'term'],
    });
  });

  it('fromMix() emits both fields', () => {
    const accendo = Products.Fex['AetnaAccendo'] as Product;
    const sel = ProductSelection.fromMix({
      types: [ProductType.Term],
      plus: [accendo],
    });
    expect(sel.toWireFields()).toEqual({
      products: [accendo.wireToken],
      include_product_class: ['term'],
    });
  });

  it('refuses empty selections', () => {
    expect(() => ProductSelection.of([])).toThrow(/at least one product/);
    expect(() => ProductSelection.byTypes([])).toThrow(/at least one type/);
    expect(() => ProductSelection.fromMix({})).toThrow(/at least one type or product/);
  });
});
