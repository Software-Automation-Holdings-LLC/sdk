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
export declare enum ProductType {
    FinalExpense = "final_expense",
    Term = "term",
    WholeLife = "whole_life",
    MedicareSupplement = "medicare_supplement",
    Universal = "universal",
    Indexed = "indexed"
}
/**
 * A single product offered by a carrier. The `wireToken` is the engine's
 * canonical brand-and-type string; `displayName` is for surfaces. Internal
 * regex-anchoring details live in the catalog and never escape Tier 3.
 */
export interface Product {
    /** Carrier brand identifier (e.g., "colonial-penn"). */
    readonly brand: string;
    /** Product type. */
    readonly type: ProductType;
    /**
     * The wire token the prequalify body accepts. Stable across SDK versions
     * within the same wire major version.
     */
    readonly wireToken: string;
    /** Human-readable name for UI rendering. */
    readonly displayName: string;
}
/**
 * One or more `Product` values selected for a single prequalify call.
 * `ProductSelection.toWireString()` produces the regex-anchored expression
 * the engine accepts; callers never assemble it manually.
 */
export declare class ProductSelection {
    private readonly products;
    constructor(products: ReadonlyArray<Product>);
    /** Construct from a single product (the common case). */
    static of(product: Product): ProductSelection;
    /** Construct from many products (carrier comparison). */
    static many(products: ReadonlyArray<Product>): ProductSelection;
    /** Read-only view of the underlying products. */
    list(): ReadonlyArray<Product>;
    /**
     * Render to the prequalify wire string. The shape — a `|`-joined list of
     * `<brand>.<type>` tokens — is the engine's stable contract; we lock it in
     * here so call sites never reach into the regex.
     */
    toWireString(): string;
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
export declare class ProductCatalog {
    private readonly products;
    constructor(products: ReadonlyArray<Product>);
    /** The default catalog shipped with the SDK. */
    static readonly Default: ProductCatalog;
    /**
     * Look up a product by brand and type. Throws if no match exists; callers
     * who need a soft-miss path should call `tryFind` instead.
     */
    find(brand: string, type: ProductType): Product;
    /** Soft variant of `find`; returns `undefined` if no match exists. */
    tryFind(brand: string, type: ProductType): Product | undefined;
    /** All products in the catalog (read-only). */
    list(): ReadonlyArray<Product>;
}
//# sourceMappingURL=product.d.ts.map