/**
 * Generated catalog module — do not hand-edit; rerun the generator.
 *
 * Produced by `packages/ts/scripts/gen-catalog.mjs`.
 * Regenerate with `npm run gen:catalog` (runs automatically before `build`).
 *
 * Source data:
 *   - insurance/v2_products.json
 */

export enum Product {}
export interface ProductMetadata {
  readonly slug: string;
  readonly displayName: string;
  readonly carrier: string;
  readonly productClass: string;
  readonly ages: { readonly min: number; readonly max: number };
  readonly states: readonly string[];
  readonly faceAmount: { readonly min: number; readonly max: number };
  readonly stateVariations: readonly string[];
}
export const Products = Object.freeze({
  values(): readonly Product[] { return []; },
  entries(): ReadonlyArray<readonly [Product, ProductMetadata]> { return []; },
  byCarrier(_carrier: string): readonly Product[] { return []; },
  search(_query: string): readonly Product[] { return []; },
  metadata(p: Product): ProductMetadata {
    throw new Error(`Products.metadata: unknown product '${p}'`);
  },
});
