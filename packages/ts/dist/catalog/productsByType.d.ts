/**
 * Generated catalog module — do not hand-edit; rerun the generator.
 *
 * Produced by `packages/ts/scripts/gen-catalog.mjs`.
 * Regenerate with `npm run gen:catalog` (runs automatically before `build`).
 *
 * Source data:
 *   - insurance/v2_products.json
 */
/** Coarse product family. The `wireToken` is the server's class identifier. */
export declare const ProductType: {
    readonly FinalExpense: {
        readonly wireToken: "fex";
        readonly displayName: "Final Expense";
        readonly namespaceKey: "Fex";
    };
    readonly MedicareSupplement: {
        readonly wireToken: "medsup";
        readonly displayName: "Medicare Supplement";
        readonly namespaceKey: "Medsup";
    };
    readonly Preneed: {
        readonly wireToken: "preneed";
        readonly displayName: "Preneed";
        readonly namespaceKey: "Preneed";
    };
    readonly Term: {
        readonly wireToken: "term";
        readonly displayName: "Term";
        readonly namespaceKey: "Term";
    };
};
export type ProductTypeValue = (typeof ProductType)[keyof typeof ProductType];
/** A typed product. Stable across SDK releases inside one wire major. */
export interface Product {
    /**
     * Opaque product id (`prod_<uuid>`). The only stable identity for a product.
     * This is the value the v3 prequalify `products[]` filter matches — pass this
     * product (or `ProductSelection.of([...])`) and the SDK serializes this id.
     * Slugs are mutable display data; the id is not.
     */
    readonly id: string;
    readonly displayName: string;
    readonly productType: ProductTypeValue;
    /** Carrier brand extracted from the display name (first 1–2 words). */
    readonly carrier: string;
}
type ProductBag = Readonly<Record<string, Product>>;
export declare const Products: Readonly<{
    Fex: ProductBag;
    Medsup: ProductBag;
    Preneed: ProductBag;
    Term: ProductBag;
    all: () => readonly Product[];
    byId: (id: string) => Product | undefined;
    byLegacy: (productType: ProductTypeValue, displayName: string) => Product | undefined;
}>;
export {};
//# sourceMappingURL=productsByType.d.ts.map