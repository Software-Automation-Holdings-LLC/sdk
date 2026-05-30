/**
 * Reference-adapter tests: Autocorrector, MatchAlgorithm,
 * AutocompleteAlgorithm.
 *
 * Verifies the locked semantics from the v3 spec and parity with the
 * bpp2.0 picker hook the algorithms were ported from.
 */

import { describe, expect, it } from 'vitest';
import { DefaultAutocorrector, DefaultMatchAlgorithm, DefaultAutocompleteAlgorithm, Sort as ReferenceSort, type Autocorrector } from '../../src/zyins/reference/index';
import type { Concept } from '../../src/zyins/reference/Concept';

describe('DefaultAutocorrector', () => {
    const typoMap = new Map<string, string>([
        ['HYPRTENSION', 'HYPERTENSION'],
        ['CHOLESTEROL', 'HIGH CHOLESTEROL'],
        ['ASTHM', 'ASTHMA'],
        ['HOSPITILIZED', 'HOSPITALIZED'],
    ]);

    it('rewrites a typo on submit', () => {
        const a = new DefaultAutocorrector({ typoMap });
        expect(a.correct('hyprtension', { mode: 'submit' })).toBe('HYPERTENSION');
    });

    it('keyup mode skips a correction whose RHS contains the input and is longer (mid-typing guard)', () => {
        const a = new DefaultAutocorrector({ typoMap });
        // 'ASTHM' → 'ASTHMA' contains the input AND is longer → skip on keyup.
        expect(a.correct('asthm', { mode: 'keyup' })).toBe('ASTHM');
        // On submit the same input commits.
        expect(a.correct('asthm', { mode: 'submit' })).toBe('ASTHMA');
    });

    it('keyup mode compares the normalized correction length', () => {
        const a = new DefaultAutocorrector({
            typoMap: new Map([['SSS', 'ßSS']]),
        });
        expect(a.correct('sss', { mode: 'keyup' })).toBe('SSS');
    });

    it('submit mode skips a correction whose RHS is already in the text (anti-duplication guard)', () => {
        const a = new DefaultAutocorrector({ typoMap });
        // 'CHOLESTEROL' → 'HIGH CHOLESTEROL', but 'HIGH CHOLESTEROL' already has it.
        expect(a.correct('high cholesterol', { mode: 'submit' })).toBe('HIGH CHOLESTEROL');
    });

    it('submit mode does not treat related words as duplicate corrections', () => {
        const a = new DefaultAutocorrector({
            typoMap: new Map([['HYPRTENSION', 'HYPERTENSION']]),
        });
        expect(a.correct('hypertensive hyprtension', { mode: 'submit' })).toBe('HYPERTENSIVE HYPERTENSION');
    });

    it('preserves trailing whitespace marker', () => {
        const a = new DefaultAutocorrector({ typoMap });
        // Cross-language SDK contract: trailing whitespace is preserved as
        // a single space (Python / PHP parity). The bpp2.0 hook's
        // double-space artifact is NOT part of the v3 spec.
        expect(a.correct('hyprtension ', { mode: 'submit' })).toBe('HYPERTENSION ');
        expect(a.correct('hyprtension', { mode: 'submit' })).toBe('HYPERTENSION');
    });

    it('corrects multiple n-grams across a single input (window-clamp parity)', () => {
        const a = new DefaultAutocorrector({ typoMap });
        // Regression: the window-clamp bug lost the second correction when
        // a longer outer window-size iteration had bumped past the tail.
        expect(a.correct('asthm hyprtension', { mode: 'submit' })).toBe('ASTHMA HYPERTENSION');
    });

    it('normalizes casing when the typo map is empty', () => {
        const a = new DefaultAutocorrector({ typoMap: new Map() });
        expect(a.correct('anything', { mode: 'submit' })).toBe('ANYTHING');
    });

    it('clears smaller corrections absorbed by a larger n-gram', () => {
        const a = new DefaultAutocorrector({
            typoMap: new Map([
                ['B', 'X'],
                ['A B C', 'Z'],
            ]),
        });
        expect(a.correct('a b c', { mode: 'submit' })).toBe('Z');
    });

    it('prefers the larger correction at the same word position', () => {
        const a = new DefaultAutocorrector({
            typoMap: new Map([
                ['DIBIETES', 'DIABETES'],
                ['DIBIETES TYPE', 'DIABETES TYPE 2'],
            ]),
        });
        expect(a.correct('dibietes type', { mode: 'submit' })).toBe('DIABETES TYPE 2');
    });

    it('does not apply corrections starting inside consumed spans', () => {
        const a = new DefaultAutocorrector({
            typoMap: new Map([
                ['A B', 'X'],
                ['B C', 'Y'],
            ]),
        });
        expect(a.correct('a b c', { mode: 'submit' })).toBe('X C');
    });

    it('does not overwrite larger corrections with smaller overlapping windows', () => {
        const a = new DefaultAutocorrector({
            typoMap: new Map([
                ['A B', 'X'],
                ['B C D', 'Y'],
            ]),
        });
        expect(a.correct('a b c d', { mode: 'submit' })).toBe('A Y');
    });

    it('fires onApplied only on actual change', () => {
        const events: { input: string; output: string }[] = [];
        const a = new DefaultAutocorrector({
            typoMap,
            onApplied: (e) => events.push({ input: e.input, output: e.output }),
        });
        a.correct('hyprtension', { mode: 'submit' });
        a.correct('xyz', { mode: 'submit' });
        expect(events.length).toBe(1);
        expect(events[0]?.output).toBe('HYPERTENSION');
    });

    it('exposes a readable versionTag', () => {
        const a = new DefaultAutocorrector({ typoMap, versionTag: '2026.05.29' });
        expect(a.versionTag).toBe('2026.05.29');
    });

    it('clone swaps the typo map while preserving onApplied', () => {
        const events: string[] = [];
        const a = new DefaultAutocorrector({
            typoMap,
            onApplied: (e) => events.push(e.output),
        });
        const b = a.clone({ typoMap: new Map([['FOO', 'BAR']]) });
        b.correct('foo', { mode: 'submit' });
        expect(events).toEqual(['BAR']);
    });

    it('satisfies the Autocorrector interface', () => {
        const a: Autocorrector = new DefaultAutocorrector({ typoMap });
        expect(typeof a.correct).toBe('function');
    });
});

describe('DefaultMatchAlgorithm', () => {
    const candidates: Concept[] = [
        {
            id: 'HIGHBLOODPRESSURE',
            name: 'High Blood Pressure',
            kind: 'condition',
            isKnown: true,
            inputText: '',
            conditions: () => [],
            medications: () => [],
            equals: () => false,
        },
        {
            id: 'DIABETES',
            name: 'Diabetes',
            kind: 'condition',
            isKnown: true,
            inputText: '',
            conditions: () => [],
            medications: () => [],
            equals: () => false,
        },
    ];

    it('resolves case-insensitive input through make_key', () => {
        const m = new DefaultMatchAlgorithm();
        const hit = m.match('high blood pressure', candidates);
        expect(hit.id).toBe('HIGHBLOODPRESSURE');
    });

    it('resolves display names when ids are opaque', () => {
        const m = new DefaultMatchAlgorithm();
        const hit = m.match('high blood pressure', [
            {
                ...candidates[0],
                id: 'cond_01HZX6K7QZ6R9A8B7C6D5E4F3B',
            },
        ]);
        expect(hit.id).toBe('cond_01HZX6K7QZ6R9A8B7C6D5E4F3B');
    });

    it('returns an UnknownConcept on a miss', () => {
        const m = new DefaultMatchAlgorithm();
        const miss = m.match('mystery', candidates);
        expect(miss.kind).toBe('unknown');
        expect(miss.id).toBeNull();
    });

    it('clone preserves versionTag', () => {
        const m = new DefaultMatchAlgorithm({ versionTag: 'v1' });
        expect(m.clone().versionTag).toBe('v1');
        expect(m.clone({ versionTag: 'v2' }).versionTag).toBe('v2');
    });
});

describe('DefaultAutocompleteAlgorithm', () => {
    function makeCandidate(id: string, name: string, kind: 'medication' | 'condition'): Concept {
        return {
            id,
            name,
            kind,
            isKnown: true,
            inputText: '',
            conditions: () => [],
            medications: () => [],
            equals: () => false,
        };
    }

    const candidates: Concept[] = [
        makeCandidate('LISINOPRIL', 'Lisinopril', 'medication'),
        makeCandidate('LOSARTAN', 'Losartan', 'medication'),
        makeCandidate('LITHIUM', 'Lithium', 'medication'),
        makeCandidate('AMOXICILLIN', 'Amoxicillin', 'medication'),
    ];

    it('ranks startsWith candidates first', async () => {
        const algo = new DefaultAutocompleteAlgorithm();
        const out = await algo.rank('li', candidates, {
            limit: 10,
            kinds: ['medication'],
            frequencies: new Map(),
        });
        // 'Lisinopril' + 'Lithium' both start with 'li' — order is by wordCount asc, both =1.
        const ids = out.map((s) => s.id);
        expect(ids[0]).toMatch(/^(LISINOPRIL|LITHIUM)$/);
        expect(ids).toContain('LISINOPRIL');
        expect(ids).toContain('LITHIUM');
    });

    it('applies frequency boost within a bucket when frequencies are present', async () => {
        const algo = new DefaultAutocompleteAlgorithm();
        const out = await algo.rank('li', candidates, {
            limit: 10,
            kinds: ['medication'],
            frequencies: new Map([
                ['LISINOPRIL', 4120],
                ['LITHIUM', 50],
            ]),
        });
        // LISINOPRIL (4120) ranks above LITHIUM (50) within the startsWith bucket.
        expect(out[0]?.id).toBe('LISINOPRIL');
    });

    it('skips frequency boost when no candidate has a frequency entry', async () => {
        const algo = new DefaultAutocompleteAlgorithm();
        const out = await algo.rank('li', candidates, {
            limit: 10,
            kinds: ['medication'],
            frequencies: new Map([['NONEXISTENT', 1000]]),
        });
        // Falls back to bucket order; LISINOPRIL + LITHIUM both present.
        expect(out.map((s) => s.id).sort()).toContain('LITHIUM');
    });

    it('respects the limit', async () => {
        const algo = new DefaultAutocompleteAlgorithm();
        const out = await algo.rank('l', candidates, {
            limit: 1,
            kinds: ['medication'],
            frequencies: new Map(),
        });
        expect(out.length).toBe(1);
    });

    it('Alphabetical sort emits matches A→Z regardless of frequency (B2)', async () => {
        const algo = new DefaultAutocompleteAlgorithm();
        // Frequencies that would invert A→Z under MostCommonFirst — Losartan
        // highest, Lisinopril lowest — to prove Alphabetical ignores frequency.
        const frequencies = new Map([
            ['LOSARTAN', 9000],
            ['LITHIUM', 5000],
            ['LISINOPRIL', 10],
        ]);
        const out = await algo.rank('li', candidates, {
            limit: 10,
            kinds: ['medication'],
            frequencies,
            sort: ReferenceSort.Alphabetical,
        });
        // 'li' matches Lisinopril + Lithium (startsWith) and Amoxicillin
        // (substring 'LI' in amoxiciLLIn). A→Z order is fixed, frequency-blind.
        expect(out.map((s) => s.id)).toEqual(['AMOXICILLIN', 'LISINOPRIL', 'LITHIUM']);
    });

    it('MostCommonFirst (the default) keeps frequency order — proves Alphabetical is opt-in', async () => {
        const algo = new DefaultAutocompleteAlgorithm();
        const frequencies = new Map([
            ['LITHIUM', 5000],
            ['LISINOPRIL', 10],
        ]);
        const out = await algo.rank('li', candidates, {
            limit: 10,
            kinds: ['medication'],
            frequencies,
        });
        // Within the startsWith bucket, LITHIUM (5000) beats LISINOPRIL (10);
        // AMOXICILLIN lands in the lower substring bucket, so it trails both.
        expect(out.map((s) => s.id)).toEqual(['LITHIUM', 'LISINOPRIL', 'AMOXICILLIN']);
    });

    it('Alphabetical flattens across relevance buckets — every match A→Z', async () => {
        const algo = new DefaultAutocompleteAlgorithm();
        // 'pressure' is a substring of "High Blood Pressure" (bucket: substring
        // match) while "Blood Pressure Cuff" startsWith fails but contains it.
        const conds: Concept[] = [makeCandidate('HIGHBLOODPRESSURE', 'High Blood Pressure', 'condition'), makeCandidate('LOWBLOODPRESSURE', 'Low Blood Pressure', 'condition'), makeCandidate('BLOODPRESSURECUFF', 'Blood Pressure Cuff', 'condition')];
        const out = await algo.rank('pressure', conds, {
            limit: 10,
            kinds: ['condition'],
            frequencies: new Map([['HIGHBLOODPRESSURE', 9000]]),
            sort: ReferenceSort.Alphabetical,
        });
        expect(out.map((s) => s.name)).toEqual(['Blood Pressure Cuff', 'High Blood Pressure', 'Low Blood Pressure']);
    });

    it('returns no suggestions for an empty or whitespace-only query', async () => {
        const algo = new DefaultAutocompleteAlgorithm();
        for (const query of ['', '   ', '\t\n']) {
            const out = await algo.rank(query, candidates, {
                limit: 10,
                kinds: ['medication'],
                frequencies: new Map(),
            });
            expect(out).toEqual([]);
        }
    });

    it('caps suggestions at the documented maximum limit', async () => {
        const algo = new DefaultAutocompleteAlgorithm();
        const manyCandidates = Array.from({ length: 300 }, (_, i) => makeCandidate(`LARGE_${i}`, `Large ${i}`, 'medication'));
        const out = await algo.rank('large', manyCandidates, {
            limit: 300,
            kinds: ['medication'],
            frequencies: new Map(),
        });
        expect(out.length).toBe(250);
    });

    it('returns no suggestions when limit disables output', async () => {
        const algo = new DefaultAutocompleteAlgorithm();
        const out = await algo.rank('l', candidates, {
            limit: 0,
            kinds: ['medication'],
            frequencies: new Map(),
        });
        expect(out).toEqual([]);
    });

    it('ranks independent word intersections before word-count supersets', async () => {
        const algo = new DefaultAutocompleteAlgorithm();
        const out = await algo.rank('alpha beta', [makeCandidate('WORD_COUNT_SUPERSET', 'Gamma Alpha Beta', 'condition'), makeCandidate('INDEPENDENT_INTERSECTION', 'Gamma Alpha Betamax', 'condition')], {
            limit: 10,
            kinds: ['condition'],
            frequencies: new Map(),
        });
        expect(out.map((s) => s.id)).toEqual(['INDEPENDENT_INTERSECTION', 'WORD_COUNT_SUPERSET']);
    });

    it('filters by kinds', async () => {
        const algo = new DefaultAutocompleteAlgorithm();
        const out = await algo.rank('l', candidates, {
            limit: 10,
            kinds: ['condition'],
            frequencies: new Map(),
        });
        expect(out.length).toBe(0);
    });

    it('emits Suggestion handles with score, matchedSpan, rank', async () => {
        const algo = new DefaultAutocompleteAlgorithm();
        const out = await algo.rank('lis', candidates, {
            limit: 10,
            kinds: ['medication'],
            frequencies: new Map(),
        });
        expect(out[0]?.rank).toBe(0);
        expect(out[0]?.score).toBeGreaterThan(0);
        expect(out[0]?.matchedSpan[1]).toBeGreaterThan(out[0]?.matchedSpan[0] ?? 0);
    });

    it('computes display-name matched spans for names containing parentheses', async () => {
        const algo = new DefaultAutocompleteAlgorithm();
        const out = await algo.rank('alpha beta', [makeCandidate('PAREN', 'Alpha (Beta)', 'condition')], { limit: 10, kinds: ['condition'], frequencies: new Map() });
        expect(out[0]?.matchedSpan).toEqual([0, 'Alpha (Beta'.length]);
    });

    it('startOnly mode emits only prefix matches', async () => {
        const algo = new DefaultAutocompleteAlgorithm({ startOnly: true });
        const out = await algo.rank('lis', candidates, {
            limit: 10,
            kinds: ['medication'],
            frequencies: new Map(),
        });
        expect(out.every((s) => s.name.toUpperCase().startsWith('LIS'))).toBe(true);
    });
});
