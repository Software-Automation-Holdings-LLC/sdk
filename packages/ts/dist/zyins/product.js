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
export { ProductType, Products, } from '../catalog/productsByType';
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
        this.explicit = explicit;
        this.types = types;
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
            fields.products = this.explicit.map((p) => p.wireToken);
        }
        if (this.types.length > 0) {
            fields.include_product_class = this.types.map((t) => t.wireToken);
        }
        return fields;
    }
}
//# sourceMappingURL=product.js.map