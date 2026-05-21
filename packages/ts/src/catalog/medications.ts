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
 * Medication uses (indications). A "use" is a canonical condition name
 * (engine wire format) that at least one medication treats. The
 * `medications` array lists every medication recorded as treating
 * that use.
 *
 * Catalog size is large (~3000 uses; ~6000 medications); only the names
 * you import are retained by tree-shakers.
 */
export interface MedicationUseMetadata {
  readonly displayName: string;
  readonly medications: readonly string[];
}

const USES: Readonly<Record<string, MedicationUseMetadata>> = Object.freeze({

});

const ALL_USES: readonly string[] = Object.freeze(Object.keys(USES).sort());

export const MedicationUses = Object.freeze({
  values(): readonly string[] {
    return ALL_USES;
  },
  metadata(u: string): MedicationUseMetadata {
    const m = USES[u];
    if (!m) throw new Error(`MedicationUses.metadata: unknown use '${u}'`);
    return m;
  },
});
