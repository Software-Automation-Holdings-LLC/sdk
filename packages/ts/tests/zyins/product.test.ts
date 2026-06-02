/**
 * Product catalog tests.
 *
 * Covers the nested-by-type `Products` namespace, the `byId` reverse lookup,
 * the conformance round-trip invariant, and the typed-only `ProductSelection`
 * factories.
 */

import { describe, expect, it } from 'vitest';
import {
  Products,
  ProductClass,
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

  it('every product carries a prod_<uuid> id', () => {
    for (const p of Products.all()) {
      expect(p.id).toMatch(/^prod_[0-9a-f-]+$/);
    }
  });

  it('no product has a wireToken field on the public type', () => {
    // wireToken must not appear on the Product interface — only id is identity.
    for (const p of Products.all()) {
      expect('wireToken' in p).toBe(false);
    }
  });

  it('byId roundtrips: every product resolves to itself', () => {
    for (const p of Products.all()) {
      expect(Products.byId(p.id)).toBe(p);
    }
    expect(Products.byId('prod_does-not-exist')).toBeUndefined();
  });

  it('conformance: byId(AetnaAccendo.id) === AetnaAccendo (strict reference equality)', () => {
    const accendo = Products.Fex['AetnaAccendo'] as Product;
    expect(accendo).toBeDefined();
    expect(Products.byId(accendo.id)).toBe(accendo);
  });

  it('conformance: a stale name does not resolve — only ids resolve via byId', () => {
    // byId accepts only prod_<uuid> strings; display names must not match.
    const accendo = Products.Fex['AetnaAccendo'] as Product;
    expect(Products.byId(accendo.displayName)).toBeUndefined();
    expect(Products.byId('fex-aetna-accendo')).toBeUndefined();
    expect(Products.byId('Aetna Accendo')).toBeUndefined();
  });

  it('byLegacy is case-insensitive on display name within a type', () => {
    const accendo = Products.Fex['AetnaAccendo'] as Product;
    const found = Products.byLegacy(ProductClass.FinalExpense, accendo.displayName.toLowerCase());
    expect(found?.id).toBe(accendo.id);
    expect(
      Products.byLegacy(ProductClass.Term, accendo.displayName),
    ).toBeUndefined();
  });
});

describe('ProductSelection factories', () => {
  it('of() emits products[] with prod_<uuid> ids in toWireFields()', () => {
    const accendo = Products.Fex['AetnaAccendo'] as Product;
    const sel = ProductSelection.of([accendo]);
    const fields = sel.toWireFields();
    expect(fields.products).toEqual([accendo.id]);
    expect(fields.products![0]).toMatch(/^prod_[0-9a-f-]+$/);
  });

  it('byTypes() emits include_product_class[]', () => {
    const sel = ProductSelection.byTypes([ProductClass.FinalExpense, ProductClass.Term]);
    expect(sel.toWireFields()).toEqual({
      include_product_class: ['fex', 'term'],
    });
  });

  it('fromMix() emits both fields', () => {
    const accendo = Products.Fex['AetnaAccendo'] as Product;
    const sel = ProductSelection.fromMix({
      types: [ProductClass.Term],
      plus: [accendo],
    });
    expect(sel.toWireFields()).toEqual({
      products: [accendo.id],
      include_product_class: ['term'],
    });
  });

  it('copies inputs so later caller mutation cannot change wire fields', () => {
    const accendo = Products.Fex['AetnaAccendo'] as Product;
    const products = [accendo];
    const types = [ProductClass.Term];
    const sel = ProductSelection.fromMix({ types, plus: products });

    products.pop();
    types.pop();

    expect(sel.toWireFields()).toEqual({
      products: [accendo.id],
      include_product_class: ['term'],
    });
  });

  it('refuses empty selections', () => {
    expect(() => ProductSelection.of([])).toThrow(/at least one product/);
    expect(() => ProductSelection.byTypes([])).toThrow(/at least one type/);
    expect(() => ProductSelection.fromMix({})).toThrow(/at least one type or product/);
  });
});
