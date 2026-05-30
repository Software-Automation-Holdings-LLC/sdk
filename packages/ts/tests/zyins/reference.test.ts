/**
 * `isa.zyins.reference` facade tests.
 *
 * Covers the locked design from `docs/sdk-syntax-proposal.md`:
 *   - `match()` is sync, never rejects, preserves `inputText`.
 *   - The text→id index builds lazily from the cached v3 datasets
 *     bundle and survives `getV3()` retries that resolve to the same
 *     etag.
 *   - A fresh bundle (different etag) invalidates the index — the next
 *     match() call sees the new catalog.
 *   - Symmetric traversal sorts by `Sort.MostCommonFirst` /
 *     `Sort.Alphabetical`.
 *   - Equality is id-based; case-insensitive inputs collapse.
 *   - Top-level shortcuts `isa.zyins.medications.match()` and
 *     `isa.zyins.conditions.match()` resolve through the same cache.
 */

import { describe, expect, it } from 'vitest';
import type { DatasetBundleV3 } from '../../src/zyins/datasets-v3';
import { ReferenceBundleCache, ReferenceFacade, Sort, ReferenceMedicationsFacade, ReferenceConditionsFacade, ReferenceConceptsFacade, DefaultMatchAlgorithm, type MatchAlgorithm } from '../../src/zyins/reference/index';
import type { Concept } from '../../src/zyins/reference/Concept';

// ---------------------------------------------------------------------------
// Fixture: a synthetic v3 bundle that mirrors the real wire shape. The
// catalog is intentionally tiny so the frequency / alphabetical
// orderings have unambiguous expected values.
// ---------------------------------------------------------------------------

function bundle(overrides: Partial<DatasetBundleV3> = {}): DatasetBundleV3 {
    const base: DatasetBundleV3 = {
        etag: 'W/"catalog-v3-a"',
        version: '3.0',
        medications: [
            {
                id: 'INSULIN',
                name: 'Insulin',
                used_for: [{ id: 'DIABETES', name: 'Diabetes', prescription_count: 9000 }],
            },
            {
                id: 'LISINOPRIL',
                name: 'Lisinopril',
                used_for: [{ id: 'HIGHBLOODPRESSURE', name: 'High Blood Pressure', prescription_count: 4120 }],
            },
            {
                id: 'LOSARTAN',
                name: 'Losartan',
                used_for: [{ id: 'HIGHBLOODPRESSURE', name: 'High Blood Pressure', prescription_count: 880 }],
            },
            {
                id: 'METFORMIN',
                name: 'Metformin',
                used_for: [{ id: 'DIABETES', name: 'Diabetes', prescription_count: 5000 }],
            },
        ],
        conditions: [
            {
                id: 'DIABETES',
                name: 'Diabetes',
                treated_with: [
                    { id: 'INSULIN', name: 'Insulin', prescription_count: 9000 },
                    { id: 'METFORMIN', name: 'Metformin', prescription_count: 5000 },
                ],
            },
            {
                id: 'HIGHBLOODPRESSURE',
                name: 'High Blood Pressure',
                treated_with: [
                    { id: 'LISINOPRIL', name: 'Lisinopril', prescription_count: 4120 },
                    { id: 'LOSARTAN', name: 'Losartan', prescription_count: 880 },
                ],
            },
        ],
        products: [],
        nicotineOptions: [],
        spellingCorrections: [],
        datasets: {
            medications: undefined,
            conditions: undefined,
            products: undefined,
            spelling_corrections: undefined,
            nicotine_options: undefined,
        },
        productsByFamily: {},
        discontinuedProducts: {},
        stateDerivatives: [],
    };
    return { ...base, ...overrides };
}

function facade(b: DatasetBundleV3 = bundle()): {
    facade: ReferenceFacade;
    cache: ReferenceBundleCache;
} {
    const cache = new ReferenceBundleCache();
    cache.setBundle(b);
    return { facade: new ReferenceFacade(cache), cache };
}

describe('ReferenceFacade — match() basic semantics', () => {
    it('returns a typed Concept on a case-insensitive catalog hit', () => {
        const { facade: ref } = facade();
        // Condition: "High Blood Pressure" → keyed by HIGHBLOODPRESSURE.
        // The lookup strips non-alphanumerics + uppercases, so both
        // 'high blood pressure' and 'HighBloodPressure' resolve.
        const hbp = ref.conditions.match('high blood pressure');
        expect(hbp.kind).toBe('condition');
        expect(hbp.isKnown).toBe(true);
        expect(hbp.id).toBe('HIGHBLOODPRESSURE');
        expect(hbp.name).toBe('High Blood Pressure');

        const lisinopril = ref.medications.match('Lisinopril');
        expect(lisinopril.kind).toBe('medication');
        expect(lisinopril.isKnown).toBe(true);
        expect(lisinopril.id).toBe('LISINOPRIL');
        expect(lisinopril.name).toBe('Lisinopril');
        expect(lisinopril.inputText).toBe('Lisinopril');
    });

    it('returns an unknown handle for free text — never rejects', () => {
        const { facade: ref } = facade();
        const unknown = ref.medications.match('unknown drug XR 2025');
        expect(unknown.kind).toBe('unknown');
        expect(unknown.isKnown).toBe(false);
        expect(unknown.id).toBeNull();
        expect(unknown.inputText).toBe('unknown drug XR 2025');
        expect(unknown.name).toBe('unknown drug XR 2025');
        expect(unknown.conditions(Sort.MostCommonFirst)).toEqual([]);
        expect(unknown.medications(Sort.MostCommonFirst)).toEqual([]);
    });

    it('returns an unknown handle when no bundle has been warmed', () => {
        const cache = new ReferenceBundleCache();
        const ref = new ReferenceFacade(cache);
        const result = ref.medications.match('Lisinopril');
        expect(result.kind).toBe('unknown');
        expect(result.isKnown).toBe(false);
        expect(result.inputText).toBe('Lisinopril');
    });

    it('preserves inputText verbatim through resolution', () => {
        const { facade: ref } = facade();
        const m = ref.medications.match('  Lisinopril  ');
        // Even though the lookup succeeds (the key strips non-alphanumerics),
        // `inputText` is preserved verbatim — whitespace and all.
        expect(m.kind).toBe('medication');
        expect(m.isKnown).toBe(true);
        expect(m.inputText).toBe('  Lisinopril  ');
        expect(m.name).toBe('Lisinopril');
    });

    it('matches text against names when catalog ids are opaque', () => {
        const { facade: ref } = facade({
            medications: [
                {
                    id: 'med_01HZX6K7QZ6R9A8B7C6D5E4F3A',
                    name: 'Lisinopril',
                    used_for: [],
                },
            ],
            conditions: [
                {
                    id: 'cond_01HZX6K7QZ6R9A8B7C6D5E4F3B',
                    name: 'High Blood Pressure',
                    treated_with: [],
                },
            ],
        });

        expect(ref.medications.match('lisinopril').id).toBe('med_01HZX6K7QZ6R9A8B7C6D5E4F3A');
        expect(ref.conditions.match('high blood pressure').id).toBe('cond_01HZX6K7QZ6R9A8B7C6D5E4F3B');
        expect(ref.concepts.match('Lisinopril').id).toBe('med_01HZX6K7QZ6R9A8B7C6D5E4F3A');
    });

    it('uses injected matcher results as the source of truth', () => {
        const cache = new ReferenceBundleCache();
        cache.setBundle(bundle());
        const matcher: MatchAlgorithm = {
            match(query: string, candidates: readonly Concept[]): Concept {
                const id = query === 'lisinoPRI' ? 'LISINOPRIL' : 'HIGHBLOODPRESSURE';
                const hit = candidates.find((candidate) => candidate.id === id);
                if (hit !== undefined) return hit;
                return {
                    id: null,
                    name: query,
                    kind: 'unknown',
                    isKnown: false,
                    inputText: query,
                    conditions: () => [],
                    medications: () => [],
                    equals: () => false,
                };
            },
        };
        const ref = new ReferenceFacade(cache, { matchAlgorithm: matcher });

        const medication = ref.medications.match('lisinoPRI');
        expect(medication.kind).toBe('medication');
        expect(medication.id).toBe('LISINOPRIL');
        expect(medication.inputText).toBe('lisinoPRI');

        const concept = ref.concepts.match('hbp');
        expect(concept.kind).toBe('condition');
        expect(concept.id).toBe('HIGHBLOODPRESSURE');

        expect(ref.concepts.matchMany(['lisinoPRI', 'hbp']).map((c) => c.id)).toEqual(['LISINOPRIL', 'HIGHBLOODPRESSURE']);
    });

    it('routes explicit DefaultMatchAlgorithm overrides through the matcher path', () => {
        const cache = new ReferenceBundleCache();
        cache.setBundle(
            bundle({
                medications: [
                    {
                        id: 'med_01HZX6K7QZ6R9A8B7C6D5E4F3B',
                        name: 'Opaque Medication',
                        used_for: [],
                    },
                ],
            }),
        );
        const ref = new ReferenceFacade(cache, { matchAlgorithm: new DefaultMatchAlgorithm() });
        const medication = ref.medications.match('med_01HZX6K7QZ6R9A8B7C6D5E4F3B');
        expect(medication.kind).toBe('medication');
        expect(medication.id).toBe('med_01HZX6K7QZ6R9A8B7C6D5E4F3B');
    });
});

describe('ReferenceFacade — symmetric traversal', () => {
    it("sorts a condition's medications by descending frequency", () => {
        const { facade: ref } = facade();
        const hbp = ref.conditions.match('High Blood Pressure');
        const meds = hbp.medications(Sort.MostCommonFirst);
        expect(meds.map((m) => m.id)).toEqual(['LISINOPRIL', 'LOSARTAN']);
    });

    it("sorts a condition's medications alphabetically", () => {
        const { facade: ref } = facade();
        const diab = ref.conditions.match('diabetes');
        const meds = diab.medications(Sort.Alphabetical);
        expect(meds.map((m) => m.name)).toEqual(['Insulin', 'Metformin']);
    });

    it('defaults sort to MostCommonFirst', () => {
        const { facade: ref } = facade();
        const hbp = ref.conditions.match('High Blood Pressure');
        expect(hbp.medications().map((m) => m.id)).toEqual(['LISINOPRIL', 'LOSARTAN']);
    });

    it("returns the medication's conditions sorted by frequency (longest list first)", () => {
        const b = bundle({
            // Add insulin to HBP at low frequency so `INSULIN.conditions` has
            // two entries and the frequency order is unambiguous.
            medications: [
                {
                    id: 'INSULIN',
                    name: 'Insulin',
                    used_for: [
                        { id: 'DIABETES', name: 'Diabetes', prescription_count: 9000 },
                        { id: 'HIGHBLOODPRESSURE', name: 'High Blood Pressure', prescription_count: 50 },
                    ],
                },
                {
                    id: 'LISINOPRIL',
                    name: 'Lisinopril',
                    used_for: [{ id: 'HIGHBLOODPRESSURE', name: 'High Blood Pressure', prescription_count: 4120 }],
                },
                {
                    id: 'LOSARTAN',
                    name: 'Losartan',
                    used_for: [{ id: 'HIGHBLOODPRESSURE', name: 'High Blood Pressure', prescription_count: 880 }],
                },
                {
                    id: 'METFORMIN',
                    name: 'Metformin',
                    used_for: [{ id: 'DIABETES', name: 'Diabetes', prescription_count: 5000 }],
                },
            ],
            conditions: [
                {
                    id: 'DIABETES',
                    name: 'Diabetes',
                    treated_with: [
                        { id: 'INSULIN', name: 'Insulin', prescription_count: 9000 },
                        { id: 'METFORMIN', name: 'Metformin', prescription_count: 5000 },
                    ],
                },
                {
                    id: 'HIGHBLOODPRESSURE',
                    name: 'High Blood Pressure',
                    treated_with: [
                        { id: 'LISINOPRIL', name: 'Lisinopril', prescription_count: 4120 },
                        { id: 'LOSARTAN', name: 'Losartan', prescription_count: 880 },
                        { id: 'INSULIN', name: 'Insulin', prescription_count: 50 },
                    ],
                },
            ],
        });
        const { facade: ref } = facade(b);
        const insulin = ref.medications.match('INSULIN');
        const conds = insulin.conditions(Sort.MostCommonFirst);
        expect(conds.map((c) => c.id)).toEqual(['DIABETES', 'HIGHBLOODPRESSURE']);
    });
});

describe('ReferenceFacade — equality', () => {
    it('case-insensitive inputs resolve to the same id and are equal', () => {
        const { facade: ref } = facade();
        const a = ref.medications.match('INSULIN');
        const b = ref.medications.match('insulin');
        expect(a.equals(b)).toBe(true);
        expect(b.equals(a)).toBe(true);
    });

    it('two unknown handles are never equal', () => {
        const { facade: ref } = facade();
        const a = ref.medications.match('mystery 1');
        const b = ref.medications.match('mystery 1');
        expect(a.equals(b)).toBe(false);
    });

    it('mismatched kinds are not equal even when ids collide', () => {
        const { facade: ref } = facade();
        const cond = ref.conditions.match('DIABETES');
        const med = ref.medications.match('INSULIN');
        expect(cond.equals(med)).toBe(false);
    });
});

describe('ReferenceFacade — bundle versioning', () => {
    it('rebuilds the index when a new bundle (different etag) is set', () => {
        const v1 = bundle({ etag: 'W/"v1"' });
        const cache = new ReferenceBundleCache();
        cache.setBundle(v1);
        const ref = new ReferenceFacade(cache);
        expect(ref.medications.match('INSULIN').isKnown).toBe(true);

        // v2 catalog: drop INSULIN, add NOVOLOG.
        const v2 = bundle({
            etag: 'W/"v2"',
            medications: [
                {
                    id: 'NOVOLOG',
                    name: 'Novolog',
                    used_for: [{ id: 'DIABETES', name: 'Diabetes', prescription_count: 7000 }],
                },
                {
                    id: 'METFORMIN',
                    name: 'Metformin',
                    used_for: [{ id: 'DIABETES', name: 'Diabetes', prescription_count: 5000 }],
                },
            ],
            conditions: [
                {
                    id: 'DIABETES',
                    name: 'Diabetes',
                    treated_with: [
                        { id: 'NOVOLOG', name: 'Novolog', prescription_count: 7000 },
                        { id: 'METFORMIN', name: 'Metformin', prescription_count: 5000 },
                    ],
                },
            ],
        });
        cache.setBundle(v2);
        expect(ref.medications.match('INSULIN').isKnown).toBe(false);
        expect(ref.medications.match('NOVOLOG').isKnown).toBe(true);
    });

    it('reuses the index when the same etag is re-supplied', () => {
        const v1 = bundle({ etag: 'W/"v1"' });
        const v1Again = bundle({ etag: 'W/"v1"' });
        const cache = new ReferenceBundleCache();
        cache.setBundle(v1);
        const ref = new ReferenceFacade(cache);
        const idxBefore = cache.currentIndex();
        cache.setBundle(v1Again);
        const idxAfter = cache.currentIndex();
        expect(idxAfter).toBe(idxBefore);
        expect(ref.medications.match('INSULIN').isKnown).toBe(true);
    });

    it('keeps same-version derived maps pinned to the indexed bundle', () => {
        const cache = new ReferenceBundleCache();
        cache.setBundle(
            bundle({
                etag: 'W/"v1"',
                spellingCorrections: [{ id: 'AA_ALPHA', name: 'aa', from: 'aa', to: 'Alpha' }],
            }),
        );
        const ref = new ReferenceFacade(cache);
        expect(cache.currentIndex()).toBeDefined();

        cache.setBundle(
            bundle({
                etag: 'W/"v1"',
                medications: [],
                spellingCorrections: [{ id: 'AA_BETA', name: 'aa', from: 'aa', to: 'Beta' }],
            }),
        );

        expect(ref.medications.match('INSULIN').isKnown).toBe(true);
        expect(ref.autocorrector.correct('aa', { mode: 'submit' })).toBe('ALPHA');
    });

    it('keeps same-version derived maps pinned before the index is built', () => {
        const cache = new ReferenceBundleCache();
        cache.setBundle(
            bundle({
                etag: 'W/"v1"',
                spellingCorrections: [{ id: 'AA_ALPHA', name: 'aa', from: 'aa', to: 'Alpha' }],
            }),
        );
        const ref = new ReferenceFacade(cache);
        expect(ref.autocorrector.correct('aa', { mode: 'submit' })).toBe('ALPHA');

        cache.setBundle(
            bundle({
                etag: 'W/"v1"',
                spellingCorrections: [{ id: 'AA_BETA', name: 'aa', from: 'aa', to: 'Beta' }],
            }),
        );

        expect(ref.autocorrector.correct('aa', { mode: 'submit' })).toBe('ALPHA');
        expect(ref.medications.match('INSULIN').isKnown).toBe(true);
    });

    it('rebuilds caches for unversioned bundles', () => {
        const cache = new ReferenceBundleCache();
        cache.setBundle(
            bundle({
                etag: undefined,
                version: '',
                spellingCorrections: [{ id: 'AA_ALPHA', name: 'aa', from: 'aa', to: 'Alpha' }],
            }),
        );
        const ref = new ReferenceFacade(cache);
        expect(ref.medications.match('INSULIN').isKnown).toBe(true);
        expect(ref.autocorrector.correct('aa', { mode: 'submit' })).toBe('ALPHA');

        cache.setBundle(
            bundle({
                etag: undefined,
                version: '',
                medications: [{ id: 'NOVOLOG', name: 'Novolog', used_for: [] }],
                spellingCorrections: [{ id: 'AA_BETA', name: 'aa', from: 'aa', to: 'Beta' }],
            }),
        );

        expect(ref.medications.match('INSULIN').isKnown).toBe(false);
        expect(ref.medications.match('NOVOLOG').isKnown).toBe(true);
        expect(ref.autocorrector.correct('aa', { mode: 'submit' })).toBe('BETA');
    });
});

describe('ReferenceFacade — Tier 3 sugar', () => {
    it('matchMany returns one handle per input, preserving order', () => {
        const { facade: ref } = facade();
        const results = ref.concepts.matchMany(['Lisinopril', 'mystery', 'Diabetes']);
        expect(results.map((r) => r.kind)).toEqual(['medication', 'unknown', 'condition']);
        expect(results[1]?.inputText).toBe('mystery');
    });

    it('medications.list() enumerates every known medication', () => {
        const { facade: ref } = facade();
        const all = ref.medications.list();
        expect(all.map((m) => m.id).sort()).toEqual(['INSULIN', 'LISINOPRIL', 'LOSARTAN', 'METFORMIN']);
    });

    it('conditions.list() enumerates every known condition', () => {
        const { facade: ref } = facade();
        const all = ref.conditions.list();
        expect(all.map((c) => c.id).sort()).toEqual(['DIABETES', 'HIGHBLOODPRESSURE']);
    });

    it('list() returns [] when no bundle is warmed', () => {
        const cache = new ReferenceBundleCache();
        const ref = new ReferenceFacade(cache);
        expect(ref.medications.list()).toEqual([]);
        expect(ref.conditions.list()).toEqual([]);
    });
});

describe('Facade types — instance class identity', () => {
    it('exposes the sub-facade classes by their public names', () => {
        const { facade: ref } = facade();
        expect(ref.medications).toBeInstanceOf(ReferenceMedicationsFacade);
        expect(ref.conditions).toBeInstanceOf(ReferenceConditionsFacade);
        expect(ref.concepts).toBeInstanceOf(ReferenceConceptsFacade);
    });
});

// ---------------------------------------------------------------------------
// End-to-end through `Isa` — the LOCKED top-level surface from
// `docs/sdk-syntax-proposal.md` requires consumers to call
//   isa.zyins.medications.match('insulin')
// without ever touching `reference` or threading a bundle. The Isa
// constructor wires `DatasetsFacade.getV3()` into the same shared
// `ReferenceBundleCache` that backs `isa.zyins.medications/conditions/
// concepts`, so a single `getV3()` call (or external bundle injection)
// primes every top-level accessor.
//
// This block proves the wiring end-to-end with an in-memory transport so
// no real HTTP layer is needed.
// ---------------------------------------------------------------------------

import { Isa, LicenseAuth, inMemoryEngineWith } from '../../src/zyins';
import type { Transport, TransportResponse } from '../../src/zyins/transport';
import { TEST_AUTH } from './fixtures';

const V3_DATASETS_BODY = JSON.stringify({
    object: 'datasets',
    request_id: 'req_01HZK2N5GQR9T8X4B6FJW3Y1AS',
    idempotency_key: null,
    livemode: true,
    data: {
        catalog_version: '3.0',
        datasets: {
            conditions: {
                version: '3.0',
                item_count: 2,
                items: [
                    {
                        id: 'DIABETES',
                        name: 'Diabetes',
                        treated_with: [
                            { id: 'INSULIN', name: 'Insulin', prescription_count: 9000 },
                            { id: 'METFORMIN', name: 'Metformin', prescription_count: 5000 },
                        ],
                    },
                    {
                        id: 'HIGHBLOODPRESSURE',
                        name: 'High Blood Pressure',
                        treated_with: [{ id: 'LISINOPRIL', name: 'Lisinopril', prescription_count: 4120 }],
                    },
                ],
            },
            medications: {
                version: '3.0',
                item_count: 3,
                items: [
                    {
                        id: 'INSULIN',
                        name: 'Insulin',
                        used_for: [{ id: 'DIABETES', name: 'Diabetes', prescription_count: 9000 }],
                    },
                    {
                        id: 'METFORMIN',
                        name: 'Metformin',
                        used_for: [{ id: 'DIABETES', name: 'Diabetes', prescription_count: 5000 }],
                    },
                    {
                        id: 'LISINOPRIL',
                        name: 'Lisinopril',
                        used_for: [{ id: 'HIGHBLOODPRESSURE', name: 'High Blood Pressure', prescription_count: 4120 }],
                    },
                ],
            },
        },
    },
});

function datasetsTransport(etag = 'W/"catalog-v3-isa-top-level"'): Transport {
    return async (req): Promise<TransportResponse> => {
        if (req.url.includes('/v3/datasets')) {
            return { status: 200, body: V3_DATASETS_BODY, headers: { etag } };
        }
        return { status: 404, body: '', headers: {} };
    };
}

async function buildIsa(transport: Transport): Promise<Isa> {
    return Isa.create({
        auth: LicenseAuth.fromKeycode(TEST_AUTH.licenseKey, TEST_AUTH.email, {
            orderId: TEST_AUTH.orderId,
            licenseKey: TEST_AUTH.licenseKey,
        }),
        engine: inMemoryEngineWith(transport),
    });
}

describe('isa.zyins.medications/conditions/concepts — top-level cache-backed shortcuts', () => {
    it('isa.zyins.medications.match() returns a known concept after datasets.getV3() primes the cache', async () => {
        const isa = await buildIsa(datasetsTransport());

        // Pre-warm the shared cache through the public datasets facade. No
        // bundle argument is ever threaded through to `match()`.
        await isa.zyins.datasets.getV3();

        const insulin = isa.zyins.medications.match('insulin');
        expect(insulin.kind).toBe('medication');
        expect(insulin.isKnown).toBe(true);
        expect(insulin.id).toBe('INSULIN');

        const diabetes = isa.zyins.conditions.match('Diabetes');
        expect(diabetes.kind).toBe('condition');
        expect(diabetes.isKnown).toBe(true);
        expect(diabetes.id).toBe('DIABETES');

        const concept = isa.zyins.reference.concepts.match('Lisinopril');
        expect(concept.kind).toBe('medication');
        expect(concept.isKnown).toBe(true);
    });

    it('returns an unknown concept (never throws) before the cache is warmed', async () => {
        const isa = await buildIsa(datasetsTransport());
        const handle = isa.zyins.medications.match('insulin');
        expect(handle.isKnown).toBe(false);
        expect(handle.inputText).toBe('insulin');
    });

    it('isa.zyins.medications is identity-equal to isa.zyins.reference.medications', async () => {
        const isa = await buildIsa(datasetsTransport());
        expect(isa.zyins.medications).toBe(isa.zyins.reference.medications);
        expect(isa.zyins.conditions).toBe(isa.zyins.reference.conditions);
    });

    it('a fresh bundle with a new etag invalidates the cache end-to-end', async () => {
        // First response: insulin is in the catalog.
        let body = V3_DATASETS_BODY;
        let etag = 'W/"catalog-v3-a"';
        const transport: Transport = async (req): Promise<TransportResponse> => {
            if (req.url.includes('/v3/datasets')) {
                return { status: 200, body, headers: { etag } };
            }
            return { status: 404, body: '', headers: {} };
        };

        const isa = await buildIsa(transport);
        await isa.zyins.datasets.getV3();
        expect(isa.zyins.medications.match('insulin').isKnown).toBe(true);

        // Server rotates the catalog: drop INSULIN, add NOVOLOG. Etag rotates.
        body = JSON.stringify({
            object: 'datasets',
            request_id: 'req_01HZK2N5GQR9T8X4B6FJW3Y1AS',
            idempotency_key: null,
            livemode: true,
            data: {
                catalog_version: '3.1',
                datasets: {
                    medications: {
                        version: '3.1',
                        item_count: 1,
                        items: [{ id: 'NOVOLOG', name: 'Novolog', used_for: [] }],
                    },
                },
            },
        });
        etag = 'W/"catalog-v3-b"';
        await isa.zyins.datasets.getV3();

        expect(isa.zyins.medications.match('insulin').isKnown).toBe(false);
        expect(isa.zyins.medications.match('Novolog').isKnown).toBe(true);
    });
});
