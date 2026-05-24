/**
 * Generated catalog module — do not hand-edit; rerun the generator.
 *
 * Produced by `packages/ts/scripts/gen-catalog.mjs`.
 * Regenerate with `npm run gen:catalog` (runs automatically before `build`).
 *
 * Source data:
 *   - insurance/v2_products.json
 */
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
export interface Product {
    readonly wireToken: string;
    readonly displayName: string;
    readonly productType: ProductTypeValue;
    readonly carrier: string;
}
export declare const Products: Readonly<{
    Fex: Readonly<Record<string, Product>>;
    Medsup: Readonly<Record<string, Product>>;
    Preneed: Readonly<Record<string, Product>>;
    Term: Readonly<Record<string, Product>>;
    all(): readonly Product[];
    byWireToken(_t: string): Product | undefined;
    byLegacy(_pt: ProductTypeValue, _n: string): Product | undefined;
}>;
//# sourceMappingURL=productsByType.d.ts.map