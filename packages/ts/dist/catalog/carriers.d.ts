/**
 * Generated catalog module — do not hand-edit; rerun the generator.
 *
 * Produced by `packages/ts/scripts/gen-catalog.mjs`.
 * Regenerate with `npm run gen:catalog` (runs automatically before `build`).
 *
 * Source data:
 *   - insurance/v2_products.json
 */
import { Product } from './products.js';
import type { State } from './states.js';
/** Public metadata for a single carrier. */
export interface ProductCarrierMetadata {
    readonly displayName: string;
    readonly products: readonly Product[];
    /** ISO 2-letter state codes the carrier is licensed in. */
    readonly states: readonly State[];
}
/**
 * Catalog API for carriers. Carrier slugs are stable; display names follow
 * the engine's product catalog.
 *
 * `states` is empty today — per-carrier licensure is not currently
 * surfaced in the public reference data. Treat as advisory.
 */
export declare const ProductCarriers: Readonly<{
    values(): readonly string[];
    metadata(c: string): ProductCarrierMetadata;
}>;
//# sourceMappingURL=carriers.d.ts.map