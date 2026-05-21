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
/**
 * Categories partition the canonical condition list into clinically
 * related groups. The engine's reference data does not currently expose
 * a stable category taxonomy; this catalog is intentionally empty until
 * the upstream publishes one. The shape is fixed so consumers can code
 * against it today.
 */
export interface ConditionCategoryMetadata {
    readonly displayName: string;
    /** Canonical condition names (uppercase, engine wire format). */
    readonly conditions: readonly string[];
}
export declare const ConditionCategories: Readonly<{
    values(): readonly string[];
    metadata(c: string): ConditionCategoryMetadata;
}>;
//# sourceMappingURL=conditions.d.ts.map