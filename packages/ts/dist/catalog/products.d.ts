/**
 * Generated catalog module — do not hand-edit; rerun the generator.
 *
 * Produced by `packages/ts/scripts/gen-catalog.mjs`.
 * Regenerate with `npm run gen:catalog` (runs automatically before `build`).
 *
 * Source data:
 *   - insurance/v2_products.json
 */
export declare enum Product {
}
export interface ProductMetadata {
    readonly slug: string;
    readonly displayName: string;
    readonly carrier: string;
    readonly productClass: string;
    readonly ages: {
        readonly min: number;
        readonly max: number;
    };
    readonly states: readonly string[];
    readonly faceAmount: {
        readonly min: number;
        readonly max: number;
    };
    readonly stateVariations: readonly string[];
}
export declare const Products: Readonly<{
    values(): readonly Product[];
    entries(): ReadonlyArray<readonly [Product, ProductMetadata]>;
    byCarrier(_carrier: string): readonly Product[];
    search(_query: string): readonly Product[];
    metadata(p: Product): ProductMetadata;
}>;
//# sourceMappingURL=products.d.ts.map