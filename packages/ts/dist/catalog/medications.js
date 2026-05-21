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
const USES = Object.freeze({});
const ALL_USES = Object.freeze(Object.keys(USES).sort());
export const MedicationUses = Object.freeze({
    values() {
        return ALL_USES;
    },
    metadata(u) {
        const m = USES[u];
        if (!m)
            throw new Error(`MedicationUses.metadata: unknown use '${u}'`);
        return m;
    },
});
//# sourceMappingURL=medications.js.map