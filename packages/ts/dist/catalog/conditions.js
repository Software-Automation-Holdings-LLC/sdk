/**
 * Generated catalog module — do not hand-edit; rerun the generator.
 *
 * Produced by `packages/ts/scripts/gen-catalog.mjs`.
 * Regenerate with `npm run gen:catalog` (runs automatically before `build`).
 *
 * Source data:
 *   - insurance/v2_conditions.json
 *   - insurance/v2_medications.json
 */
const CATEGORIES = Object.freeze({});
const ALL_CATEGORIES = Object.freeze([]);
export const ConditionCategories = Object.freeze({
    values() {
        return ALL_CATEGORIES;
    },
    metadata(c) {
        const m = CATEGORIES[c];
        if (!m)
            throw new Error(`ConditionCategories.metadata: unknown category '${c}'`);
        return m;
    },
});
//# sourceMappingURL=conditions.js.map