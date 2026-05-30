/**
 * Conformance test for the v3 `reference` namespace.
 *
 * Loads `shared/schemas/sdk/testdata/reference_vectors.json` — the
 * cross-language ground truth — and asserts the TS SDK matches every
 * `make_key` parity vector and every `match()` scenario. The same JSON
 * drives the Go / Python / C# / PHP parity tests; drift between
 * languages must surface here.
 */

import { describe, expect, it } from 'vitest';
import vectors from '../../../../shared/schemas/sdk/testdata/reference_vectors.json';
import { __internal, matchCondition, matchConcept, matchMedication, Sort } from '../../src/zyins/reference';
import type { ConditionEntity, DatasetBundleV3, DatasetCategory, DatasetEntry, MedicationEntity } from '../../src/zyins/datasets-v3';

interface ReferenceEntity {
    readonly id: string;
    readonly name: string;
}

interface BundleFixture {
    readonly version: string;
    readonly conditions: ReadonlyArray<ReferenceEntity>;
    readonly medications: ReadonlyArray<ReferenceEntity>;
    readonly medications_by_condition: Readonly<Record<string, readonly string[]>>;
    readonly frequency_graphs: {
        readonly use_map: Readonly<Record<string, Readonly<Record<string, number>>>>;
    };
}

interface MakeKeyVector {
    readonly input: string;
    readonly expected: string;
}

interface MatchVector {
    readonly name: string;
    readonly matcher: 'medications' | 'conditions' | 'concepts';
    readonly input: string;
    readonly expected_kind: 'medication' | 'condition' | 'unknown';
    readonly expected_known: boolean;
    readonly expected_id: string | null;
    readonly input_text_preserved?: string;
    readonly medications_most_common_first?: ReadonlyArray<string>;
    readonly medications_alphabetical?: ReadonlyArray<string>;
    readonly conditions_most_common_first?: ReadonlyArray<string>;
    readonly conditions_any_known?: boolean;
}

interface Vectors {
    readonly make_key: ReadonlyArray<MakeKeyVector>;
    readonly bundle: BundleFixture;
    readonly matches: ReadonlyArray<MatchVector>;
}

const typedVectors = vectors as unknown as Vectors;

function bundleFromFixture(fixture: BundleFixture): DatasetBundleV3 {
    // Locked v3 wire is inline-row; the shared fixture is the legacy map
    // shape (kept until every lang migrates). Project the maps into rows
    // here so the SDK consumes its locked shape.
    const conditions: ConditionEntity[] = fixture.conditions.map((c) => {
        const medIds = fixture.medications_by_condition[c.id] ?? [];
        const treated = medIds.map((medId) => {
            const med = fixture.medications.find((m) => m.id === medId);
            const pc = fixture.frequency_graphs.use_map[c.id]?.[medId] ?? 0;
            return {
                id: medId,
                name: med?.name ?? medId,
                prescription_count: pc,
            };
        });
        treated.sort((a, b) => {
            if (b.prescription_count !== a.prescription_count) {
                return b.prescription_count - a.prescription_count;
            }
            return a.name.localeCompare(b.name);
        });
        return { id: c.id, name: c.name, treated_with: treated };
    });

    // Reverse the maps to build medication.used_for[] inline.
    const usedForByMed = new Map<string, { id: string; name: string; prescription_count: number }[]>();
    for (const [condId, medIds] of Object.entries(fixture.medications_by_condition)) {
        const cond = fixture.conditions.find((x) => x.id === condId);
        for (const medId of medIds) {
            const pc = fixture.frequency_graphs.use_map[condId]?.[medId] ?? 0;
            const list = usedForByMed.get(medId) ?? [];
            list.push({ id: condId, name: cond?.name ?? condId, prescription_count: pc });
            usedForByMed.set(medId, list);
        }
    }
    const medications: MedicationEntity[] = fixture.medications.map((m) => {
        const used = usedForByMed.get(m.id) ?? [];
        used.sort((a, b) => {
            if (b.prescription_count !== a.prescription_count) {
                return b.prescription_count - a.prescription_count;
            }
            return a.name.localeCompare(b.name);
        });
        return { id: m.id, name: m.name, used_for: used };
    });

    const conditionsEntry: DatasetEntry<ConditionEntity> = {
        version: fixture.version,
        itemCount: conditions.length,
        items: conditions,
    };
    const medicationsEntry: DatasetEntry<MedicationEntity> = {
        version: fixture.version,
        itemCount: medications.length,
        items: medications,
    };
    const datasets: Record<DatasetCategory, DatasetEntry | undefined> = {
        conditions: conditionsEntry,
        medications: medicationsEntry,
        products: undefined,
        spelling_corrections: undefined,
        nicotine_options: undefined,
    };
    return {
        etag: undefined,
        version: fixture.version,
        conditions,
        medications,
        products: [],
        nicotineOptions: [],
        spellingCorrections: [],
        datasets,
        productsByFamily: {},
        discontinuedProducts: {},
        stateDerivatives: [],
    };
}

describe('reference.makeKey — parity vectors', () => {
    for (const vec of typedVectors.make_key) {
        it(`${JSON.stringify(vec.input)} → ${JSON.stringify(vec.expected)}`, () => {
            expect(__internal.makeKey(vec.input)).toBe(vec.expected);
        });
    }
});

describe('reference.match — scenarios', () => {
    const bundle = bundleFromFixture(typedVectors.bundle);

    for (const scenario of typedVectors.matches) {
        it(scenario.name, () => {
            const concept = scenario.matcher === 'medications' ? matchMedication(scenario.input, bundle) : scenario.matcher === 'conditions' ? matchCondition(scenario.input, bundle) : matchConcept(scenario.input, bundle);

            expect(concept.kind).toBe(scenario.expected_kind);
            expect(concept.isKnown).toBe(scenario.expected_known);
            expect(concept.id).toBe(scenario.expected_id);
            expect(concept.inputText).toBe(scenario.input);

            if (scenario.input_text_preserved !== undefined) {
                expect(concept.inputText).toBe(scenario.input_text_preserved);
            }

            if (scenario.medications_most_common_first !== undefined) {
                const meds = concept.medications(Sort.MostCommonFirst);
                const ids = meds.map((m) => m.id ?? '');
                expect(ids).toEqual(scenario.medications_most_common_first);
            }
            if (scenario.medications_alphabetical !== undefined) {
                const meds = concept.medications(Sort.Alphabetical);
                const ids = meds.map((m) => m.id ?? '');
                expect(ids).toEqual(scenario.medications_alphabetical);
            }
            if (scenario.conditions_most_common_first !== undefined) {
                const conds = concept.conditions(Sort.MostCommonFirst);
                const ids = conds.map((c) => c.id ?? '');
                expect(ids).toEqual(scenario.conditions_most_common_first);
            }
            if (scenario.conditions_any_known === true) {
                const conds = concept.conditions(Sort.MostCommonFirst);
                expect(conds.length).toBeGreaterThan(0);
                expect(conds.every((c) => c.isKnown)).toBe(true);
            }
        });
    }

    it('unknown text returns empty accessors and preserves input — not an error', () => {
        const concept = matchConcept('unknown free text', bundle);
        expect(concept.isKnown).toBe(false);
        expect(concept.id).toBeNull();
        expect(concept.inputText).toBe('unknown free text');
        expect(concept.medications()).toEqual([]);
        expect(concept.conditions()).toEqual([]);
    });

    it('the canonical live bug — conditions.match("hbp").medications(MostCommonFirst) returns non-empty + freq-ordered', () => {
        const concept = matchCondition('hbp', bundle);
        expect(concept.isKnown).toBe(true);
        const meds = concept.medications(Sort.MostCommonFirst);
        expect(meds.length).toBeGreaterThan(0);
        // Frequency-descending: LISINOPRIL (4120) > AMLODIPINE (2105) > LOSARTAN (880).
        expect(meds[0]?.id).toBe('LISINOPRIL');
        expect(meds[meds.length - 1]?.id).toBe('LOSARTAN');
    });

    it('related concept handles preserve the original match input', () => {
        const condition = matchCondition('hbp', bundle);
        const medications = condition.medications(Sort.MostCommonFirst);
        expect(medications[0]?.inputText).toBe('hbp');

        const medication = matchMedication('lisinopril', bundle);
        const conditions = medication.conditions(Sort.MostCommonFirst);
        expect(conditions[0]?.inputText).toBe('lisinopril');
    });

    it('make_key is NOT exposed on the public surface — only __internal', async () => {
        const mod = (await import('../../src/zyins/reference')) as Record<string, unknown>;
        expect(mod['makeKey']).toBeUndefined();
        expect(mod['make_key']).toBeUndefined();
        // __internal is the only escape hatch and is clearly demarcated.
        expect(typeof (mod['__internal'] as { makeKey: unknown }).makeKey).toBe('function');
    });
});
