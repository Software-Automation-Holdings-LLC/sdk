/**
 * Typed product catalog + selection.
 *
 * `Product` is a typed object carrying its opaque `prod_<uuid>` id, display
 * name, type, and carrier. The id is the only stable identity — slugs are
 * mutable display data and are never placed on the wire.
 *
 * `ProductSelection.of` / `byTypes` / `fromMix` compose a selection that
 * serializes to `products[]` (id array) and/or `include_product_class[]` via
 * `toWireFields()`. Serialization is SDK-internal; callers never touch ids
 * directly.
 *
 * Nested-by-type catalog constants (`Products.Fex.AetnaAccendo`, …) and
 * reverse lookup (`Products.byId`) live in `src/catalog/productsByType.ts`
 * (re-exported below).
 */
export { ProductType as ProductClass, type ProductTypeValue as ProductClassValue, type Product, Products, } from '../catalog/productsByType.js';
import type { Product, ProductTypeValue as ProductClassValue } from '../catalog/productsByType.js';
export { ProductType } from './productType.js';
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
    private readonly explicit;
    private readonly types;
    private constructor();
    /** Pick specific products by their typed `Product` object. */
    static of(products: readonly Product[]): ProductSelection;
    /** Pick all products of one or more types. */
    static byTypes(types: readonly ProductClassValue[]): ProductSelection;
    /** Hybrid — types as the base, with extra explicit products bolted on. */
    static fromMix(opts: {
        types?: readonly ProductClassValue[];
        plus?: readonly Product[];
    }): ProductSelection;
}
//# sourceMappingURL=product.d.ts.map