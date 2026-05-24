/**
 * Generated catalog module — do not hand-edit; rerun the generator.
 *
 * Produced by `packages/ts/scripts/gen-catalog.mjs`.
 * Regenerate with `npm run gen:catalog` (runs automatically before `build`).
 *
 * Source data:
 *   - insurance/v2_products.json
 */

export const ProductType = {
  FinalExpense:       { wireToken: 'fex',     displayName: 'Final Expense',       namespaceKey: 'Fex'     },
  MedicareSupplement: { wireToken: 'medsup',  displayName: 'Medicare Supplement', namespaceKey: 'Medsup'  },
  Preneed:            { wireToken: 'preneed', displayName: 'Preneed',             namespaceKey: 'Preneed' },
  Term:               { wireToken: 'term',    displayName: 'Term',                namespaceKey: 'Term'    },
} as const;
export type ProductTypeValue = (typeof ProductType)[keyof typeof ProductType];
export interface Product { readonly wireToken: string; readonly displayName: string; readonly productType: ProductTypeValue; readonly carrier: string; }
type ProductBag = Readonly<Record<string, Product>>;
const EMPTY: ProductBag = Object.freeze({});
export const Products = Object.freeze({
  Fex: EMPTY, Medsup: EMPTY, Preneed: EMPTY, Term: EMPTY,
  all(): readonly Product[] { return []; },
  byWireToken(_t: string): Product | undefined { return undefined; },
  byLegacy(_pt: ProductTypeValue, _n: string): Product | undefined { return undefined; },
});
