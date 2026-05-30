/**
 * `AutocompleteAlgorithm` — text → ranked Suggestion[].
 *
 * Default: a direct port of the bpp2.0 picker hook
 * (`src/sah-ui/Input/TextField/useAutocomplete.js`). Candidates are
 * categorized into priority buckets, then sorted within each bucket by a
 * `(frequency + 1) * scaleFactor` score where `scaleFactor` decreases
 * as bucket priority drops.
 *
 * Bucket priorities (highest → lowest):
 *   1. `startsWith` — option starts with the literal input
 *      (sub-sort: option.wordCount ascending)
 *   2. `sameWords` — identical word set + same word count
 *   3. `independentWordIntersection` — every input word appears in option
 *   4. `wordCountNoTolerance[d]` — superset; option has `d` extra words
 *      (sub-sort: d ascending)
 *   5. `sameNumWithTolerance` — same word count, different word sets
 *   6. `wordCountWithTolerance[d]` — `d` words differ/extra
 *      (sub-sort: d ascending)
 *
 * The promise wrapper exists so future implementations can do real I/O
 * (server-side reranking, embedding lookup) without an API change; the
 * default resolves synchronously.
 *
 * @example
 * ```ts
 * const ranked = await isa.zyins.medications.autocomplete('lisi', { limit: 5 });
 * for (const s of ranked) console.log(s.rank, s.name, s.score);
 * ```
 */

import type { Concept, ConceptKind } from './Concept';
import { Sort } from './Sort';
import { type Suggestion, buildSuggestion } from './Suggestion';

/** Per-call options for {@link AutocompleteAlgorithm.rank}. */
export interface AutocompleteOptions {
    /** Maximum suggestions to return; default 25, max 250. */
    readonly limit: number;
    /** Restrict to these concept kinds. Empty/omitted = all kinds. */
    readonly kinds: readonly ConceptKind[];
    /**
     * Per-id frequency table. Higher = more common. Missing keys score 0.
     * When NO candidate has an entry, the algorithm skips the frequency
     * boost entirely and falls back to bucket order.
     */
    readonly frequencies: ReadonlyMap<string, number>;
    /**
     * Result ordering. `MostCommonFirst` (default) keeps the bucketed
     * relevance + frequency-boost order. `Alphabetical` keeps the same
     * relevance FILTER — only matching candidates are returned — but emits
     * them in a flat case-insensitive A→Z order by display name, for an
     * A-Z toggle in a narrowing UI.
     */
    readonly sort?: Sort;
}

/**
 * Rank a candidate pool against `query`. Always async — the default
 * resolves synchronously, but the contract leaves room for I/O-backed
 * rankers.
 */
export interface AutocompleteAlgorithm {
    rank(query: string, candidates: readonly Concept[], options: AutocompleteOptions): Promise<Suggestion[]>;
}

/** Constructor options for {@link DefaultAutocompleteAlgorithm}. */
export interface DefaultAutocompleteAlgorithmOptions {
    /**
     * When `true`, ONLY emit suggestions whose name starts with the
     * literal input. Useful for `medications.match` where the picker
     * displays an inline completion.
     *
     * Default `false` — populate all six buckets.
     */
    readonly startOnly?: boolean;
    /** Optional version stamp surfaced via {@link DefaultAutocompleteAlgorithm.versionTag}. */
    readonly versionTag?: string;
}

/**
 * Default ranker. Bucket + frequency-boost algorithm ported from the
 * bpp2.0 picker hook.
 *
 * @example
 * ```ts
 * const ranker = new DefaultAutocompleteAlgorithm({ startOnly: false });
 * const out = await ranker.rank('high blood', candidates, {
 *   limit: 10,
 *   kinds: ['condition'],
 *   frequencies: new Map([['HIGHBLOODPRESSURE', 4120]]),
 * });
 * ```
 */
export class DefaultAutocompleteAlgorithm implements AutocompleteAlgorithm {
    private readonly startOnly: boolean;
    private readonly _versionTag: string | undefined;

    constructor(opts: DefaultAutocompleteAlgorithmOptions = {}) {
        this.startOnly = opts.startOnly ?? false;
        this._versionTag = opts.versionTag;
    }

    /** Opaque tag tracking the version of this ranker. */
    get versionTag(): string | undefined {
        return this._versionTag;
    }

    async rank(query: string, candidates: readonly Concept[], options: AutocompleteOptions): Promise<Suggestion[]> {
        const ranked = rankSync(query, candidates, options, this.startOnly);
        return ranked;
    }

    /** Return a new ranker with selected fields overridden. */
    clone(overrides: Partial<DefaultAutocompleteAlgorithmOptions> = {}): DefaultAutocompleteAlgorithm {
        const nextVersionTag = overrides.versionTag ?? this._versionTag;
        return new DefaultAutocompleteAlgorithm({
            startOnly: overrides.startOnly ?? this.startOnly,
            ...(nextVersionTag !== undefined && { versionTag: nextVersionTag }),
        });
    }
}

// ---------------------------------------------------------------------------
// Internal — pure ranking. Separate from the class so the algorithm can be
// unit-tested without the async shell.
// ---------------------------------------------------------------------------

function tokenize(s: string): string[] {
    return String(s)
        .toUpperCase()
        .split(/\s+/)
        .map((x) => x.replace(/[^A-Z0-9]/g, ''))
        .filter(Boolean);
}

interface Bucketed {
    startsWith: Concept[];
    sameWords: Concept[];
    independentWordIntersection: Concept[];
    wordCountNoTolerance: Map<number, Concept[]>;
    sameNumWithTolerance: Concept[];
    wordCountWithTolerance: Map<number, Concept[]>;
}

const MAX_LIMIT = 250;

function rankSync(query: string, candidates: readonly Concept[], options: AutocompleteOptions, startOnly: boolean): Suggestion[] {
    const limit = Math.min(options.limit, MAX_LIMIT);
    if (limit <= 0) return [];
    // An empty / whitespace-only query has zero tokens and resolves to no
    // suggestions — guard explicitly so the substring pre-filter (which treats
    // '' as matching every candidate) cannot leak the full catalog. Mirrors the
    // Python reference adapter and the documented contract.
    if (query.trim() === '') return [];

    const queryUpper = query.toUpperCase();
    const queryClean = queryUpper.replace(/\(/g, '');
    const queryTokens = tokenize(query);

    const kindFilter = options.kinds.length > 0 ? new Set(options.kinds) : undefined;

    // 1. Filter to plausible candidates.
    const filtered: Concept[] = [];
    for (const c of candidates) {
        if (kindFilter && !kindFilter.has(c.kind)) continue;
        const nameUpper = c.name.toUpperCase().replace(/\(/g, '');
        if (startOnly) {
            if (nameUpper.startsWith(queryClean)) filtered.push(c);
            continue;
        }
        if (queryTokens.length < 2) {
            if (nameUpper.includes(queryClean)) filtered.push(c);
            continue;
        }
        // Multi-word query: keep candidates where at most one input word is missing.
        const optTokens = tokenize(c.name);
        const optSet = new Set(optTokens);
        let missing = 0;
        for (const t of queryTokens) if (!optSet.has(t)) missing++;
        if (missing <= 1) filtered.push(c);
    }

    // 2. Bucket.
    const buckets: Bucketed = {
        startsWith: [],
        sameWords: [],
        independentWordIntersection: [],
        wordCountNoTolerance: new Map(),
        sameNumWithTolerance: [],
        wordCountWithTolerance: new Map(),
    };
    for (const c of filtered) {
        const cleanedName = c.name.replace(/\(/g, '');
        const optTokens = tokenize(cleanedName);
        const optSet = new Set(optTokens);
        const querySet = new Set(queryTokens);
        const isStart = cleanedName.toUpperCase().startsWith(queryClean);
        const isSameLength = optTokens.length === queryTokens.length;
        const lengthDiff = Math.abs(queryTokens.length - optTokens.length);
        const supersetOfInput = queryTokens.every((t) => optSet.has(t));
        const sameSet = querySet.size === optSet.size && [...querySet].every((x) => optSet.has(x));
        const independentWordIntersection = !supersetOfInput && queryTokens.every((t) => cleanedName.toUpperCase().includes(t));

        if (isStart) {
            buckets.startsWith.push(c);
        } else if (isSameLength && sameSet) {
            buckets.sameWords.push(c);
        } else if (independentWordIntersection) {
            buckets.independentWordIntersection.push(c);
        } else if (supersetOfInput) {
            pushToBucket(buckets.wordCountNoTolerance, lengthDiff, c);
        } else if (isSameLength) {
            buckets.sameNumWithTolerance.push(c);
        } else {
            pushToBucket(buckets.wordCountWithTolerance, lengthDiff, c);
        }
    }

    // 3. Assemble grouped order. Sub-sort startsWith by option wordCount ascending.
    const startsWithSorted = [...buckets.startsWith].sort((a, b) => tokenize(a.name).length - tokenize(b.name).length);
    const noTolKeys = [...buckets.wordCountNoTolerance.keys()].sort((a, b) => a - b);
    const noTol = noTolKeys.flatMap((k) => buckets.wordCountNoTolerance.get(k) ?? []);
    const withTolKeys = [...buckets.wordCountWithTolerance.keys()].sort((a, b) => a - b);
    const withTol = withTolKeys.flatMap((k) => buckets.wordCountWithTolerance.get(k) ?? []);

    let groups: Concept[][] = [startsWithSorted, buckets.sameWords, buckets.independentWordIntersection, noTol, buckets.sameNumWithTolerance, withTol];

    // 4. Order within the matched set. Alphabetical flattens every bucket into
    // one A→Z group (the relevance filter already decided membership); the
    // default boosts by frequency within each bucket and keeps bucket priority.
    if (options.sort === Sort.Alphabetical) {
        groups = [flattenAlphabetical(groups)];
    } else {
        groups = applyFrequencyBoost(groups, options.frequencies);
    }

    // 5. Dedupe by id (preserve first occurrence across groups) and emit Suggestions.
    const seen = new Set<string>();
    const scoreOf = computeScoreLookup(groups, options.frequencies);
    const result: Suggestion[] = [];
    let rank = 0;
    for (const group of groups) {
        for (const c of group) {
            const key = c.id ?? `__unknown:${c.inputText}:${c.name}`;
            if (seen.has(key)) continue;
            seen.add(key);
            const matchedSpan = computeSpan(c.name, queryClean);
            result.push(
                buildSuggestion(c, {
                    score: scoreOf.get(key) ?? 0,
                    matchedSpan,
                    rank,
                }),
            );
            rank++;
            if (result.length >= limit) return result;
        }
    }
    return result;
}

/**
 * Collapse every relevance bucket into one group ordered case-insensitively
 * A→Z by display name. De-dupes by id (first occurrence across buckets wins
 * before the sort) so the same concept appearing in two buckets does not
 * double-list. Ties broken by case-sensitive name then id for stable,
 * cross-language-reproducible output.
 */
function flattenAlphabetical(groups: Concept[][]): Concept[] {
    const seen = new Set<string>();
    const flat: Concept[] = [];
    for (const group of groups) {
        for (const c of group) {
            const key = c.id ?? `__unknown:${c.inputText}:${c.name}`;
            if (seen.has(key)) continue;
            seen.add(key);
            flat.push(c);
        }
    }
    flat.sort((a, b) => {
        const an = a.name.toLowerCase();
        const bn = b.name.toLowerCase();
        if (an < bn) return -1;
        if (an > bn) return 1;
        if (a.name < b.name) return -1;
        if (a.name > b.name) return 1;
        return (a.id ?? '') < (b.id ?? '') ? -1 : (a.id ?? '') > (b.id ?? '') ? 1 : 0;
    });
    return flat;
}

function pushToBucket(map: Map<number, Concept[]>, key: number, c: Concept): void {
    const existing = map.get(key);
    if (existing) existing.push(c);
    else map.set(key, [c]);
}

function applyFrequencyBoost(groups: Concept[][], frequencies: ReadonlyMap<string, number>): Concept[][] {
    if (frequencies.size === 0) return groups;
    const total = groups.length;
    let foundAny = false;
    for (const group of groups) {
        for (const c of group) {
            if (c.id !== null && frequencies.has(c.id)) {
                foundAny = true;
                break;
            }
        }
        if (foundAny) break;
    }
    if (!foundAny) return groups;
    return groups.map((group, groupIndex) => {
        const scale = Math.max(1, total - groupIndex);
        return [...group].sort((a, b) => {
            const fa = (a.id !== null ? (frequencies.get(a.id) ?? 0) : 0) + 1;
            const fb = (b.id !== null ? (frequencies.get(b.id) ?? 0) : 0) + 1;
            const sa = fa * scale;
            const sb = fb * scale;
            if (sb !== sa) return sb - sa;
            // Tie-break alphabetical ascending — spec-aligned.
            return a.name.localeCompare(b.name);
        });
    });
}

function computeScoreLookup(groups: Concept[][], frequencies: ReadonlyMap<string, number>): Map<string, number> {
    const total = groups.length;
    const out = new Map<string, number>();
    groups.forEach((group, groupIndex) => {
        const scale = Math.max(1, total - groupIndex);
        for (const c of group) {
            const key = c.id ?? `__unknown:${c.inputText}:${c.name}`;
            if (out.has(key)) continue;
            const freq = (c.id !== null ? (frequencies.get(c.id) ?? 0) : 0) + 1;
            out.set(key, freq * scale);
        }
    });
    return out;
}

function computeSpan(name: string, queryClean: string): readonly [number, number] {
    if (!queryClean) return [0, 0];
    const normalized: string[] = [];
    const sourceIndices: number[] = [];
    for (let i = 0; i < name.length; i++) {
        if (name[i] === '(') continue;
        normalized.push(name[i]?.toUpperCase() ?? '');
        sourceIndices.push(i);
    }
    const idx = normalized.join('').indexOf(queryClean);
    if (idx < 0) return [0, 0];
    const endSourceIndex = sourceIndices[idx + queryClean.length - 1];
    if (endSourceIndex === undefined) return [0, 0];
    return [sourceIndices[idx] ?? 0, endSourceIndex + 1];
}
