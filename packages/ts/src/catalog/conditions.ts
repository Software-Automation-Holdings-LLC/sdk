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

const CATEGORIES: Readonly<Record<string, ConditionCategoryMetadata>> = Object.freeze({});

const ALL_CATEGORIES: readonly string[] = Object.freeze([]);

export const ConditionCategories = Object.freeze({
  values(): readonly string[] {
    return ALL_CATEGORIES;
  },
  metadata(c: string): ConditionCategoryMetadata {
    const m = CATEGORIES[c];
    if (!m) throw new Error(`ConditionCategories.metadata: unknown category '${c}'`);
    return m;
  },
});
