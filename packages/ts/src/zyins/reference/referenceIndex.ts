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

import type {
  ConditionEntity,
  DatasetBundleV3,
  MedicationEntity,
} from '../datasets-v3';
import { _makeKey } from './_makeKey';
import { Sort } from './Sort';
import {
  type Concept,
  type ConditionConcept,
  type MedicationConcept,
  type UnknownConcept,
} from './Concept';

export class ReferenceIndex {
  private readonly conditionById: ReadonlyMap<string, ConditionEntity>;
  private readonly conditionByKey: ReadonlyMap<string, ConditionEntity>;
  private readonly medicationById: ReadonlyMap<string, MedicationEntity>;
  private readonly medicationByKey: ReadonlyMap<string, MedicationEntity>;
  /** Bundle reference retained for traversal lookups. */
  private readonly bundle: DatasetBundleV3;

  constructor(bundle: DatasetBundleV3) {
    this.bundle = bundle;

    const conditions = new Map<string, ConditionEntity>();
    const conditionsByKey = new Map<string, ConditionEntity>();
    for (const entity of bundle.conditions) {
      conditions.set(entity.id, entity);
      conditionsByKey.set(_makeKey(entity.id), entity);
      conditionsByKey.set(_makeKey(entity.name), entity);
    }
    this.conditionById = conditions;
    this.conditionByKey = conditionsByKey;

    const medications = new Map<string, MedicationEntity>();
    const medicationsByKey = new Map<string, MedicationEntity>();
    for (const entity of bundle.medications) {
      medications.set(entity.id, entity);
      medicationsByKey.set(_makeKey(entity.id), entity);
      medicationsByKey.set(_makeKey(entity.name), entity);
    }
    this.medicationById = medications;
    this.medicationByKey = medicationsByKey;
  }

  get versionSignal(): string {
    return this.bundle.etag ?? this.bundle.version;
  }

  listMedications(): MedicationConcept[] {
    return this.bundle.medications.map((entity) =>
      this.buildMedicationConcept(entity, entity.name),
    );
  }

  listConditions(): ConditionConcept[] {
    return this.bundle.conditions.map((entity) =>
      this.buildConditionConcept(entity, entity.name),
    );
  }

  lookupMedication(text: string): MedicationConcept | UnknownConcept {
    const entity = this.resolveMedication(text);
    if (!entity) return buildUnknownConcept(text);
    return this.buildMedicationConcept(entity, text);
  }

  lookupCondition(text: string): ConditionConcept | UnknownConcept {
    const entity = this.resolveCondition(text);
    if (!entity) return buildUnknownConcept(text);
    return this.buildConditionConcept(entity, text);
  }

  lookupConcept(text: string): Concept {
    const cond = this.resolveCondition(text);
    if (cond) return this.buildConditionConcept(cond, text);
    const med = this.resolveMedication(text);
    if (med) return this.buildMedicationConcept(med, text);
    return buildUnknownConcept(text);
  }

  /** Rebuild the matched catalog concept while preserving caller input text. */
  lookupResolvedConcept(result: Concept, inputText: string): Concept {
    if (!result.isKnown || result.id === null) return buildUnknownConcept(inputText);
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

  private resolveMedication(text: string): MedicationEntity | undefined {
    const key = _makeKey(text);
    if (!key) return undefined;
    return this.medicationByKey.get(key);
  }

  private resolveCondition(text: string): ConditionEntity | undefined {
    const key = _makeKey(text);
    if (!key) return undefined;
    return this.conditionByKey.get(key);
  }

  private buildMedicationConcept(
    entity: MedicationEntity,
    inputText: string,
  ): MedicationConcept {
    const conditions = (sort?: Sort): readonly ConditionConcept[] => {
      const used = entity.used_for;
      const ordered =
        (sort ?? Sort.MostCommonFirst) === Sort.Alphabetical
          ? [...used].sort((a, b) => a.name.localeCompare(b.name))
          : [...used].sort((a, b) => {
              if (b.prescription_count !== a.prescription_count) {
                return b.prescription_count - a.prescription_count;
              }
              return a.name.localeCompare(b.name);
            });
      return ordered.map((row) => {
        const target = this.conditionById.get(row.id);
        if (target) return this.buildConditionConcept(target, inputText);
        // Stub for an id without a row (defensive — server promises both).
        return this.buildConditionConcept(
          { id: row.id, name: row.name, treated_with: [] },
          inputText,
        );
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
      equals: (other: Concept) =>
        other.kind === 'medication' && other.isKnown && other.id === entity.id,
    };
  }

  private buildConditionConcept(
    entity: ConditionEntity,
    inputText: string,
  ): ConditionConcept {
    const medications = (sort?: Sort): readonly MedicationConcept[] => {
      const treated = entity.treated_with;
      const ordered =
        (sort ?? Sort.MostCommonFirst) === Sort.Alphabetical
          ? [...treated].sort((a, b) => a.name.localeCompare(b.name))
          : [...treated].sort((a, b) => {
              if (b.prescription_count !== a.prescription_count) {
                return b.prescription_count - a.prescription_count;
              }
              return a.name.localeCompare(b.name);
            });
      return ordered.map((row) => {
        const target = this.medicationById.get(row.id);
        if (target) return this.buildMedicationConcept(target, inputText);
        return this.buildMedicationConcept(
          { id: row.id, name: row.name, used_for: [] },
          inputText,
        );
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
      equals: (other: Concept) =>
        other.kind === 'condition' && other.isKnown && other.id === entity.id,
    };
  }
}

export function buildUnknownConcept(inputText: string): UnknownConcept {
  return {
    id: null,
    name: inputText,
    kind: 'unknown',
    isKnown: false,
    inputText,
    conditions: () => [],
    medications: () => [],
    equals: (_other: Concept) => false,
  };
}
