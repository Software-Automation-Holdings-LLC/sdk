/**
 * Back-compat shim for `zyins/reference`. The canonical implementation
 * now lives in `zyins/reference/` (see `./reference/index.ts`); this file
 * re-exports the new types + adds the legacy bundle-taking helpers
 * (`matchMedication(text, bundle)`, ...) used by callers that still
 * thread a `DatasetBundleV3` through directly (e.g. the conformance
 * corpus, the products catalog builder).
 *
 * New code should use `isa.zyins.reference.medications.match(text)` —
 * the bundle is cached inside the facade.
 */
import type { DatasetBundleV3 } from './datasets-v3.js';
import { buildUnknownConcept } from './reference/referenceIndex.js';
import { _makeKey } from './reference/_makeKey.js';
import { type Concept, type ConditionConcept, type MedicationConcept, type UnknownConcept } from './reference/Concept.js';
export { Sort } from './reference/Sort.js';
export type { Concept, ConceptKind, ConditionConcept, MedicationConcept, UnknownConcept, } from './reference/Concept.js';
/**
 * Resolve free text against the medication catalog using an explicit
 * bundle. Returns a `MedicationConcept` on a hit; returns an unknown
 * handle on a miss. Never rejects.
 *
 * Prefer the facade form `isa.zyins.reference.medications.match(text)`
 * which manages the bundle for you.
 */
export declare function matchMedication(text: string, bundle: DatasetBundleV3): MedicationConcept | UnknownConcept;
/**
 * Resolve free text against the condition catalog using an explicit
 * bundle. Returns a `ConditionConcept` on a hit; returns an unknown
 * handle on a miss. Never rejects.
 */
export declare function matchCondition(text: string, bundle: DatasetBundleV3): ConditionConcept | UnknownConcept;
/**
 * Resolve free text against the catalog without specifying a kind.
 * Tries conditions first ("the user typed a symptom"), then medications.
 * Never rejects.
 */
export declare function matchConcept(text: string, bundle: DatasetBundleV3): Concept;
/**
 * Build an unknown handle directly. Exported for callers that need to
 * synthesize a placeholder concept without a catalog.
 */
export { buildUnknownConcept };
/**
 * Testing hook — exported so the conformance corpus can assert that the
 * internal normalizer matches the server-side `MakeKey`. Not part of the
 * public consumer surface; lives behind a `__internal` prefix.
 */
export declare const __internal: {
    readonly makeKey: typeof _makeKey;
};
//# sourceMappingURL=reference.d.ts.map