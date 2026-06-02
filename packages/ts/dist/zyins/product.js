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
export { ProductType as ProductClass, Products, } from '../catalog/productsByType.js';
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
export class ProductSelection {
    explicit;
    types;
    constructor(explicit, types) {
        this.explicit = [...explicit];
        this.types = [...types];
    }
    /** Pick specific products by their typed `Product` object. */
    static of(products) {
        if (products.length === 0) {
            throw new Error('ProductSelection.of: at least one product is required');
        }
        return new ProductSelection(products, []);
    }
    /** Pick all products of one or more types. */
    static byTypes(types) {
        if (types.length === 0) {
            throw new Error('ProductSelection.byTypes: at least one type is required');
        }
        return new ProductSelection([], types);
    }
    /** Hybrid — types as the base, with extra explicit products bolted on. */
    static fromMix(opts) {
        const t = opts.types ?? [];
        const p = opts.plus ?? [];
        if (t.length === 0 && p.length === 0) {
            throw new Error('ProductSelection.fromMix: provide at least one type or product');
        }
        return new ProductSelection(p, t);
    }
    /**
     * Internal — used by the prequalify serializer. Emits the two wire
     * fields the server reads.
     *
     * @internal
     */
    toWireFields() {
        const fields = {};
        if (this.explicit.length > 0) {
            // The v3 prequalify `products[]` filter matches the opaque product id
            // (`prod_<uuid>`), NOT the legacy slug — the server silently returns
            // zero plans for a slug. Serialize the id.
            fields.products = this.explicit.map((p) => p.id);
        }
        if (this.types.length > 0) {
            fields.include_product_class = this.types.map((t) => t.wireToken);
        }
        return fields;
    }
}
//# sourceMappingURL=product.js.map