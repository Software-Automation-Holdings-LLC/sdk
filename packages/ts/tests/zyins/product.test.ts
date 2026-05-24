/**
 * Product catalog tests.
 *
 * Covers: ProductCatalog.fromDatasets(), findBySlug(), ProductSelection.toWireArray().
 * Persona: fixtures use the standard product set (colonial-penn FEX, fex-aetna-accendo).
 */

import { describe, expect, it } from 'vitest';
import { ProductCatalog, ProductSelection, ProductType } from '../../src/zyins/product';

describe('ProductCatalog.fromDatasets', () => {
  it('builds a catalog from a datasets bundle with product arrays', () => {
    const bundle = {
      products: {
        fex: [
          { identifier: 'fex-aetna-accendo', carrier: 'aetna', name: 'Aetna Accendo Final Expense', product: 'fex' },
          { identifier: 'fex-colonial-penn', carrier: 'colonial-penn', name: 'Colonial Penn Final Expense', product: 'fex' },
        ],
        term: [
          { identifier: 'term-protective', carrier: 'protective', name: 'Protective Classic Choice Term', product: 'term' },
        ],
      },
    };
    const catalog = ProductCatalog.fromDatasets(bundle);
    expect(catalog.list()).toHaveLength(3);
  });

  it('maps identifier to wireToken, carrier to brand, name to displayName', () => {
    const bundle = {
      products: {
        fex: [
          { identifier: 'fex-aetna-accendo', carrier: 'aetna', name: 'Aetna Accendo Final Expense', product: 'fex' },
        ],
      },
    };
    const catalog = ProductCatalog.fromDatasets(bundle);
    const product = catalog.findBySlug('fex-aetna-accendo');
    expect(product.wireToken).toBe('fex-aetna-accendo');
    expect(product.brand).toBe('aetna');
    expect(product.displayName).toBe('Aetna Accendo Final Expense');
    expect(product.type).toBe(ProductType.FinalExpense);
  });

  it('silently skips entries missing required fields', () => {
    const bundle = {
      products: {
        fex: [
          { identifier: 'fex-aetna-accendo', carrier: 'aetna', name: 'Aetna FE', product: 'fex' },
          { carrier: 'missing-id', name: 'No ID', product: 'fex' },        // missing identifier
          { identifier: 'no-carrier', name: 'No Carrier', product: 'fex' }, // missing carrier
        ],
      },
    };
    const catalog = ProductCatalog.fromDatasets(bundle);
    expect(catalog.list()).toHaveLength(1);
  });

  it('returns an empty catalog when products is empty', () => {
    expect(ProductCatalog.fromDatasets({ products: {} }).list()).toHaveLength(0);
  });

  it('skips non-array type values', () => {
    const bundle = { products: { fex: 'not-an-array' as unknown } };
    const catalog = ProductCatalog.fromDatasets(bundle as { products: Record<string, unknown> });
    expect(catalog.list()).toHaveLength(0);
  });

  it('maps medsup product class to MedicareSupplement type', () => {
    const bundle = {
      products: {
        medsup: [
          { identifier: 'medsup-aetna', carrier: 'aetna', name: 'Aetna Medicare Supplement', product: 'medsup' },
        ],
      },
    };
    const catalog = ProductCatalog.fromDatasets(bundle);
    expect(catalog.list()[0]?.type).toBe(ProductType.MedicareSupplement);
  });
});

describe('ProductCatalog.findBySlug', () => {
  it('finds a product by wire token slug', () => {
    const bundle = {
      products: {
        fex: [
          { identifier: 'fex-aetna-accendo', carrier: 'aetna', name: 'Aetna FE', product: 'fex' },
        ],
      },
    };
    const catalog = ProductCatalog.fromDatasets(bundle);
    expect(catalog.findBySlug('fex-aetna-accendo').wireToken).toBe('fex-aetna-accendo');
  });

  it('throws when slug does not exist', () => {
    expect(() => ProductCatalog.Default.findBySlug('nonexistent-product'))
      .toThrow(/findBySlug: no product matches slug=nonexistent-product/);
  });

  it('returns undefined from tryFindBySlug on miss', () => {
    expect(ProductCatalog.Default.tryFindBySlug('ghost')).toBeUndefined();
  });
});

describe('ProductSelection.toWireArray', () => {
  it('returns string[] of wireTokens', () => {
    const p = ProductCatalog.Default.find('colonial-penn', ProductType.FinalExpense);
    const sel = ProductSelection.of(p);
    expect(sel.toWireArray()).toEqual(['colonial-penn.final-expense']);
  });

  it('returns all tokens for multi-product selection', () => {
    const p1 = ProductCatalog.Default.find('colonial-penn', ProductType.FinalExpense);
    const p2 = ProductCatalog.Default.find('mutual-of-omaha', ProductType.FinalExpense);
    const sel = ProductSelection.many([p1, p2]);
    expect(sel.toWireArray()).toEqual([
      'colonial-penn.final-expense',
      'mutual-of-omaha.final-expense',
    ]);
  });
});
