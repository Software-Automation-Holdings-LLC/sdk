/**
 * Tier 3 Product types and catalog.
 *
 * `Product` represents a single product offered by a carrier; the `wireToken`
 * is the engine's canonical identifier string used in the prequalify request's
 * `products` array. Multiple products compose via `ProductSelection`.
 *
 * The catalog can be constructed from the static default list or from a live
 * server datasets bundle via `ProductCatalog.fromDatasets(bundle)`.
 */
/**
 * Coarse product type. The wire format uses underscore-separated lowercase
 * codes; the SDK maps the enum to the code at serialization time.
 */
export var ProductType;
(function (ProductType) {
    ProductType["FinalExpense"] = "final_expense";
    ProductType["Term"] = "term";
    ProductType["WholeLife"] = "whole_life";
    ProductType["MedicareSupplement"] = "medicare_supplement";
    ProductType["Universal"] = "universal";
    ProductType["Indexed"] = "indexed";
})(ProductType || (ProductType = {}));
/**
 * One or more `Product` values selected for a single prequalify call.
 *
 * Produce the wire `products` array via `list().map(p => p.wireToken)`.
 * `toWireArray()` is a convenience shorthand for that expression.
 */
export class ProductSelection {
    products;
    constructor(products) {
        if (products.length === 0) {
            throw new Error('ProductSelection: at least one product is required');
        }
        this.products = products;
    }
    /** Construct from a single product (the common case). */
    static of(product) {
        return new ProductSelection([product]);
    }
    /** Construct from many products (carrier comparison). */
    static many(products) {
        return new ProductSelection(products);
    }
    /** Read-only view of the underlying products. */
    list() {
        return this.products;
    }
    /**
     * Returns the wire token array the prequalify body's `products` field accepts.
     * Prefer this over `toWireString()` — the server takes `string[]`, not a
     * joined string.
     */
    toWireArray() {
        return this.products.map((p) => p.wireToken);
    }
    /**
     * @deprecated Use `toWireArray()` instead. The server's `products` field
     * is `string[]`; joining with `|` is a legacy caller convention that the
     * SDK no longer needs. This method will be removed in v0.7.0.
     */
    toWireString() {
        return this.products.map((p) => p.wireToken).join('|');
    }
}
/**
 * In-memory catalog of known products.
 *
 * Two construction paths:
 *   - `ProductCatalog.Default` — the static built-in list; always available.
 *   - `ProductCatalog.fromDatasets(bundle)` — built from a live datasets
 *     bundle so the catalog stays in sync with the server.
 *
 * `find(brand, type)` and `findBySlug(slug)` are the documented entry points.
 */
export class ProductCatalog {
    products;
    constructor(products) {
        this.products = products;
    }
    /** The default catalog shipped with the SDK. */
    static Default = new ProductCatalog(DEFAULT_PRODUCTS());
    /**
     * Build a catalog from a datasets bundle returned by
     * `isa.zyins.datasets.get()`.
     *
     * The `products` field in the bundle is a map of product-class keys to
     * arrays of raw product entry objects. Each entry is mapped to a `Product`
     * with `wireToken = entry.identifier`, `brand = entry.carrier`,
     * `displayName = entry.name`. Entries missing required fields are silently
     * skipped.
     */
    static fromDatasets(bundle) {
        const products = [];
        for (const [, value] of Object.entries(bundle.products)) {
            if (!Array.isArray(value))
                continue;
            for (const entry of value) {
                const product = rawEntryToProduct(entry);
                if (product !== undefined)
                    products.push(product);
            }
        }
        return new ProductCatalog(products);
    }
    /**
     * Look up a product by brand and type. Throws if no match exists; callers
     * who need a soft-miss path should call `tryFind` instead.
     */
    find(brand, type) {
        const found = this.tryFind(brand, type);
        if (!found) {
            throw new Error(`ProductCatalog.find: no product matches brand=${brand} type=${type}`);
        }
        return found;
    }
    /** Soft variant of `find`; returns `undefined` if no match exists. */
    tryFind(brand, type) {
        return this.products.find((p) => p.brand === brand && p.type === type);
    }
    /**
     * Look up a product by its wire token slug (e.g., `"fex-aetna-accendo"`).
     * Throws if no match exists; use `tryFindBySlug` for a soft-miss path.
     */
    findBySlug(slug) {
        const found = this.tryFindBySlug(slug);
        if (!found) {
            throw new Error(`ProductCatalog.findBySlug: no product matches slug=${slug}`);
        }
        return found;
    }
    /** Soft variant of `findBySlug`; returns `undefined` if no match exists. */
    tryFindBySlug(slug) {
        return this.products.find((p) => p.wireToken === slug);
    }
    /** All products in the catalog (read-only). */
    list() {
        return this.products;
    }
}
const isRawProductEntry = (v) => v !== null &&
    typeof v === 'object' &&
    typeof v['identifier'] === 'string' &&
    typeof v['carrier'] === 'string' &&
    typeof v['name'] === 'string';
function rawEntryToProduct(entry) {
    if (!isRawProductEntry(entry))
        return undefined;
    return {
        brand: entry.carrier,
        type: mapProductClass(entry.product),
        wireToken: entry.identifier,
        displayName: entry.name,
    };
}
function mapProductClass(cls) {
    const normalized = cls.toLowerCase();
    switch (normalized) {
        case 'fex': return ProductType.FinalExpense;
        case 'term': return ProductType.Term;
        case 'wl':
        case 'whole_life':
        case 'wholelife': return ProductType.WholeLife;
        case 'medsup':
        case 'medicare_supplement': return ProductType.MedicareSupplement;
        case 'ul':
        case 'universal': return ProductType.Universal;
        case 'indexed': return ProductType.Indexed;
        default: return ProductType.FinalExpense;
    }
}
/**
 * The default product list. Kept inside a function so the export site is
 * always a fresh array (defensive against accidental mutation in tests).
 * Expansion happens in SDK releases; consumer code does NOT extend this
 * inline.
 */
function DEFAULT_PRODUCTS() {
    return [
        {
            brand: 'colonial-penn',
            type: ProductType.FinalExpense,
            wireToken: 'colonial-penn.final-expense',
            displayName: 'Colonial Penn Final Expense',
        },
        {
            brand: 'mutual-of-omaha',
            type: ProductType.FinalExpense,
            wireToken: 'mutual-of-omaha.final-expense',
            displayName: 'Mutual of Omaha Final Expense',
        },
        {
            brand: 'aetna',
            type: ProductType.MedicareSupplement,
            wireToken: 'aetna.medicare-supplement',
            displayName: 'Aetna Medicare Supplement',
        },
    ];
}
//# sourceMappingURL=product.js.map