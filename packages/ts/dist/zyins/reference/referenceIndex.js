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
import { _makeKey } from './_makeKey.js';
import { _checkKey } from './_checkKey.js';
import { Sort } from './Sort.js';
export class ReferenceIndex {
    conditionById;
    conditionByKey;
    conditionByCheckKey;
    medicationById;
    medicationByKey;
    medicationByCheckKey;
    /** Bundle reference retained for traversal lookups. */
    bundle;
    constructor(bundle) {
        this.bundle = bundle;
        const conditions = new Map();
        const conditionsByKey = new Map();
        const conditionsByCheckKey = new Map();
        for (const entity of bundle.conditions) {
            conditions.set(entity.id, entity);
            conditionsByKey.set(_makeKey(entity.id), entity);
            conditionsByKey.set(_makeKey(entity.name), entity);
            indexCheckKey(conditionsByCheckKey, entity.name, entity);
        }
        this.conditionById = conditions;
        this.conditionByKey = conditionsByKey;
        this.conditionByCheckKey = conditionsByCheckKey;
        const medications = new Map();
        const medicationsByKey = new Map();
        const medicationsByCheckKey = new Map();
        for (const entity of bundle.medications) {
            medications.set(entity.id, entity);
            medicationsByKey.set(_makeKey(entity.id), entity);
            medicationsByKey.set(_makeKey(entity.name), entity);
            indexCheckKey(medicationsByCheckKey, entity.name, entity);
        }
        this.medicationById = medications;
        this.medicationByKey = medicationsByKey;
        this.medicationByCheckKey = medicationsByCheckKey;
    }
    get versionSignal() {
        return this.bundle.etag ?? this.bundle.version;
    }
    listMedications() {
        return this.bundle.medications.map((entity) => this.buildMedicationConcept(entity, entity.name));
    }
    listConditions() {
        return this.bundle.conditions.map((entity) => this.buildConditionConcept(entity, entity.name));
    }
    lookupMedication(text) {
        const entity = this.resolveMedication(text);
        if (!entity)
            return buildUnknownConcept(text);
        return this.buildMedicationConcept(entity, text);
    }
    lookupCondition(text) {
        const entity = this.resolveCondition(text);
        if (!entity)
            return buildUnknownConcept(text);
        return this.buildConditionConcept(entity, text);
    }
    lookupConcept(text) {
        const cond = this.resolveCondition(text);
        if (cond)
            return this.buildConditionConcept(cond, text);
        const med = this.resolveMedication(text);
        if (med)
            return this.buildMedicationConcept(med, text);
        return buildUnknownConcept(text);
    }
    /** Rebuild the matched catalog concept while preserving caller input text. */
    lookupResolvedConcept(result, inputText) {
        if (!result.isKnown || result.id === null)
            return buildUnknownConcept(inputText);
        if (result.kind === 'condition') {
            const entity = this.conditionById.get(result.id);
            return entity
                ? this.buildConditionConcept(entity, inputText)
                : buildUnknownConcept(inputText);
        }
        if (result.kind === 'medication') {
            const entity = this.medicationById.get(result.id);
            return entity
                ? this.buildMedicationConcept(entity, inputText)
                : buildUnknownConcept(inputText);
        }
        return buildUnknownConcept(inputText);
    }
    resolveMedication(text) {
        const key = _makeKey(text);
        if (!key)
            return undefined;
        const exact = this.medicationByKey.get(key);
        if (exact)
            return exact;
        // Word-order-invariant fallback (engine sorted check-key). A strict
        // superset: only reached when the exact id/name key missed.
        return this.medicationByCheckKey.get(_checkKey(text));
    }
    resolveCondition(text) {
        const key = _makeKey(text);
        if (!key)
            return undefined;
        const exact = this.conditionByKey.get(key);
        if (exact)
            return exact;
        return this.conditionByCheckKey.get(_checkKey(text));
    }
    buildMedicationConcept(entity, inputText) {
        const conditions = (sort) => {
            const used = entity.used_for;
            const ordered = (sort ?? Sort.MostCommonFirst) === Sort.Alphabetical
                ? [...used].sort((a, b) => a.name.localeCompare(b.name))
                : [...used].sort((a, b) => {
                    if (b.prescription_count !== a.prescription_count) {
                        return b.prescription_count - a.prescription_count;
                    }
                    return a.name.localeCompare(b.name);
                });
            return ordered.map((row) => {
                const target = this.conditionById.get(row.id);
                if (target)
                    return this.buildConditionConcept(target, inputText);
                // Stub for an id without a row (defensive — server promises both).
                return this.buildConditionConcept({ id: row.id, name: row.name, treated_with: [] }, inputText);
            });
        };
        return {
            id: entity.id,
            name: entity.name,
            kind: 'medication',
            isKnown: true,
            inputText,
            conditions,
            medications: () => [],
            equals: (other) => other.kind === 'medication' && other.isKnown && other.id === entity.id,
        };
    }
    buildConditionConcept(entity, inputText) {
        const medications = (sort) => {
            const treated = entity.treated_with;
            const ordered = (sort ?? Sort.MostCommonFirst) === Sort.Alphabetical
                ? [...treated].sort((a, b) => a.name.localeCompare(b.name))
                : [...treated].sort((a, b) => {
                    if (b.prescription_count !== a.prescription_count) {
                        return b.prescription_count - a.prescription_count;
                    }
                    return a.name.localeCompare(b.name);
                });
            return ordered.map((row) => {
                const target = this.medicationById.get(row.id);
                if (target)
                    return this.buildMedicationConcept(target, inputText);
                return this.buildMedicationConcept({ id: row.id, name: row.name, used_for: [] }, inputText);
            });
        };
        return {
            id: entity.id,
            name: entity.name,
            kind: 'condition',
            isKnown: true,
            inputText,
            medications,
            conditions: () => [],
            equals: (other) => other.kind === 'condition' && other.isKnown && other.id === entity.id,
        };
    }
}
/**
 * Index an entity under its name's sorted check key, first-write-wins.
 *
 * Two catalog names that share a letter multiset (rare, and a catalog
 * authoring smell) must resolve deterministically; keeping the first
 * insertion mirrors the engine's iteration-order determinism rather than
 * letting later rows silently shadow earlier ones.
 */
function indexCheckKey(map, name, entity) {
    const key = _checkKey(name);
    if (!key || map.has(key))
        return;
    map.set(key, entity);
}
export function buildUnknownConcept(inputText) {
    return {
        id: null,
        name: inputText,
        kind: 'unknown',
        isKnown: false,
        inputText,
        conditions: () => [],
        medications: () => [],
        equals: (_other) => false,
    };
}
//# sourceMappingURL=referenceIndex.js.map