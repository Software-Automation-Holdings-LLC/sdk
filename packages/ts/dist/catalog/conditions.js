/**
 * Generated catalog module — do not hand-edit; rerun the generator.
 *
 * Produced by `packages/ts/scripts/gen-catalog.mjs`.
 * Regenerate with `npm run gen:catalog` (runs automatically before `build`).
 *
 * Source data:
 *   - insurance/v2_conditions.json
 */
const CATEGORIES = Object.freeze({});
const ALL_CATEGORIES = Object.freeze([]);
/** Catalog API for condition categories. */
export const ConditionCategories = Object.freeze({
    /** Return every condition category slug in stable catalog order. */
    values() {
        return ALL_CATEGORIES;
    },
    /** Return metadata for a condition category, or throw for unknown input. */
    metadata(c) {
        if (!Object.hasOwn(CATEGORIES, c))
            throw new Error(`ConditionCategories.metadata: unknown category '${c}'`);
        return CATEGORIES[c];
    },
});
//# sourceMappingURL=conditions.js.map