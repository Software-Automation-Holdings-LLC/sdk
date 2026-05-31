/**
 * Generated catalog module — do not hand-edit; rerun the generator.
 *
 * Produced by `packages/ts/scripts/gen-catalog.mjs`.
 * Regenerate with `npm run gen:catalog` (runs automatically before `build`).
 *
 * Source data:
 *   - insurance/v2_products.json
 */

import type { Product } from './products.js';
import type { State } from './states.js';
export interface ProductCarrierMetadata {
  readonly displayName: string;
  readonly products: readonly Product[];
  readonly states: readonly State[];
}
export const ProductCarriers = Object.freeze({
  values(): readonly string[] { return []; },
  metadata(c: string): ProductCarrierMetadata {
    throw new Error(`ProductCarriers.metadata: unknown carrier '${c}'`);
  },
});
