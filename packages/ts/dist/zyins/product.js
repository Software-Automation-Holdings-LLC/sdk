/**
 * Tier 3 Product types and catalog.
 *
 * The prequalify wire accepts a "product string" — a regex-anchored
 * brand+type expression that filters which carrier/plan combinations the
 * engine evaluates. bpp2.0 today assembles that string inline:
 *
 *     productStr.replace(/\s/g, '.').replace(/\$/g, '.[a-zA-Z\\-\\s\\*0-9]+$')
 *
 * Tier 3 hides the regex by exposing a typed `Product` with brand+type
 * fields and a `ProductCatalog.find(brand, type)` lookup. Multiple products
 * compose via `ProductSelection`, which knows how to render itself into the
 * wire format. The call site never spells the regex.
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
 * `ProductSelection.toWireString()` produces the regex-anchored expression
 * the engine accepts; callers never assemble it manually.
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
     * Render to the prequalify wire string. The shape — a `|`-joined list of
     * `<brand>.<type>` tokens — is the engine's stable contract; we lock it in
     * here so call sites never reach into the regex.
     */
    toWireString() {
        return this.products.map((p) => p.wireToken).join('|');
    }
}
/**
 * In-memory catalog of known products. The default catalog ships with the
 * SDK; the constructor accepts an override for tests and for consumers that
 * add a custom-tenant product.
 *
 * `find(brand, type)` is the only documented entry point; the underlying
 * array is intentionally not exported. New product onboarding ships as an
 * SDK release, not as caller-side configuration.
 */
export class ProductCatalog {
    products;
    constructor(products) {
        this.products = products;
    }
    /** The default catalog shipped with the SDK. */
    static Default = new ProductCatalog(DEFAULT_PRODUCTS());
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
    /** All products in the catalog (read-only). */
    list() {
        return this.products;
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