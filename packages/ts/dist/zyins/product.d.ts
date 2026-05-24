/**
 * Typed product catalog + selection.
 *
 * `Product` is a typed object — never a bare string. Each product carries
 * its wire token, display name, type, and carrier. Selection composes via
 * `ProductSelection.of` / `byTypes` / `fromMix` — all of which round-trip
 * through `toWireFields()` into the prequalify request body.
 *
 * The flat catalog and nested-by-type access surfaces live in
 * `src/catalog/productsByType.ts` (re-exported below). Per the locked design,
 * regex / string-based product matching is gone; the server treats `products`
 * as an exact-slug list.
 */
export { ProductType, type ProductTypeValue, type Product, Products, } from '../catalog/productsByType';
import type { Product, ProductTypeValue } from '../catalog/productsByType';
/**
 * One or more products selected for a single prequalify call.
 *
 * Three construction modes:
 *   - `ProductSelection.of(products)` — pick specific products.
 *   - `ProductSelection.byTypes(types)` — pick every product of one or
 *     more types.
 *   - `ProductSelection.fromMix({types, plus})` — types as a base plus
 *     explicit overrides.
 *
 * The selection serializes to two wire fields (`products[]` and/or
 * `include_product_class[]`) via {@link toWireFields}; serialization is
 * internal to the SDK and never exposed to call sites.
 */
export declare class ProductSelection {
    readonly explicit: readonly Product[];
    readonly types: readonly ProductTypeValue[];
    private constructor();
    /** Pick specific products by their typed `Product` object. */
    static of(products: readonly Product[]): ProductSelection;
    /** Pick all products of one or more types. */
    static byTypes(types: readonly ProductTypeValue[]): ProductSelection;
    /** Hybrid — types as the base, with extra explicit products bolted on. */
    static fromMix(opts: {
        types?: readonly ProductTypeValue[];
        plus?: readonly Product[];
    }): ProductSelection;
}
//# sourceMappingURL=product.d.ts.map