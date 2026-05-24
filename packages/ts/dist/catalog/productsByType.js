/**
 * Generated catalog module — do not hand-edit; rerun the generator.
 *
 * Produced by `packages/ts/scripts/gen-catalog.mjs`.
 * Regenerate with `npm run gen:catalog` (runs automatically before `build`).
 *
 * Source data:
 *   - insurance/v2_products.json
 */
export const ProductType = {
    FinalExpense: { wireToken: 'fex', displayName: 'Final Expense', namespaceKey: 'Fex' },
    MedicareSupplement: { wireToken: 'medsup', displayName: 'Medicare Supplement', namespaceKey: 'Medsup' },
    Preneed: { wireToken: 'preneed', displayName: 'Preneed', namespaceKey: 'Preneed' },
    Term: { wireToken: 'term', displayName: 'Term', namespaceKey: 'Term' },
};
const EMPTY = Object.freeze({});
export const Products = Object.freeze({
    Fex: EMPTY, Medsup: EMPTY, Preneed: EMPTY, Term: EMPTY,
    all() { return []; },
    byWireToken(_t) { return undefined; },
    byLegacy(_pt, _n) { return undefined; },
});
//# sourceMappingURL=productsByType.js.map