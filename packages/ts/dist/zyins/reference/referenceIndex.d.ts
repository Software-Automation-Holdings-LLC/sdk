/**
 * `ReferenceIndex` — text→id lookup + symmetric traversal over a single
 * `DatasetBundleV3` snapshot (inline-row shape).
 *
 * Built once per bundle by `ReferenceBundleCache.currentIndex()` and
 * retained for the lifetime of the bundle's `etag` / `version`. When a
 * fresh bundle (different version signal) arrives the cache drops this
 * index and rebuilds on the next `match()` call.
 *
 * Module-private. Consumers only ever see `Concept` handles via the
 * `ReferenceFacade`.
 */
import type { DatasetBundleV3 } from '../datasets-v3.js';
import { type Concept, type ConditionConcept, type MedicationConcept, type UnknownConcept } from './Concept.js';
export declare class ReferenceIndex {
    private readonly conditionById;
    private readonly conditionByKey;
    private readonly medicationById;
    private readonly medicationByKey;
    /** Bundle reference retained for traversal lookups. */
    private readonly bundle;
    constructor(bundle: DatasetBundleV3);
    get versionSignal(): string;
    listMedications(): MedicationConcept[];
    listConditions(): ConditionConcept[];
    lookupMedication(text: string): MedicationConcept | UnknownConcept;
    lookupCondition(text: string): ConditionConcept | UnknownConcept;
    lookupConcept(text: string): Concept;
    /** Rebuild the matched catalog concept while preserving caller input text. */
    lookupResolvedConcept(result: Concept, inputText: string): Concept;
    private resolveMedication;
    private resolveCondition;
    private buildMedicationConcept;
    private buildConditionConcept;
}
export declare function buildUnknownConcept(inputText: string): UnknownConcept;
//# sourceMappingURL=referenceIndex.d.ts.map