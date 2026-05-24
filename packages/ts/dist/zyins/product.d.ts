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
 *
 * Produce the wire `products` array via `list().map(p => p.wireToken)`.
 * `toWireArray()` is a convenience shorthand for that expression.
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
     * Returns the wire token array the prequalify body's `products` field accepts.
     * Prefer this over `toWireString()` — the server takes `string[]`, not a
     * joined string.
     */
    toWireArray(): ReadonlyArray<string>;
    /**
     * @deprecated Use `toWireArray()` instead. The server's `products` field
     * is `string[]`; joining with `|` is a legacy caller convention that the
     * SDK no longer needs. This method will be removed in v0.7.0.
     */
    toWireString(): string;
}
/**
 * Raw product entry as returned by `GET /v2/reference-data` under
 * `data.datasets.products.data[type][n]`. Used exclusively by
 * `ProductCatalog.fromDatasets`; consumers never construct this directly.
 */
export interface RawProductEntry {
    /** Engine identifier / wire token (e.g., `"fex-aetna-accendo"`). */
    identifier: string;
    /** Carrier brand slug (e.g., `"aetna"`). */
    carrier: string;
    /** Human-readable product name (e.g., `"Aetna Accendo Final Expense"`). */
    name: string;
    /** Product class key (e.g., `"fex"`, `"term"`, `"medsup"`). */
    product: string;
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
export declare class ProductCatalog {
    private readonly products;
    constructor(products: ReadonlyArray<Product>);
    /** The default catalog shipped with the SDK. */
    static readonly Default: ProductCatalog;
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
    static fromDatasets(bundle: {
        products: Readonly<Record<string, unknown>>;
    }): ProductCatalog;
    /**
     * Look up a product by brand and type. Throws if no match exists; callers
     * who need a soft-miss path should call `tryFind` instead.
     */
    find(brand: string, type: ProductType): Product;
    /** Soft variant of `find`; returns `undefined` if no match exists. */
    tryFind(brand: string, type: ProductType): Product | undefined;
    /**
     * Look up a product by its wire token slug (e.g., `"fex-aetna-accendo"`).
     * Throws if no match exists; use `tryFindBySlug` for a soft-miss path.
     */
    findBySlug(slug: string): Product;
    /** Soft variant of `findBySlug`; returns `undefined` if no match exists. */
    tryFindBySlug(slug: string): Product | undefined;
    /** All products in the catalog (read-only). */
    list(): ReadonlyArray<Product>;
}
//# sourceMappingURL=product.d.ts.map