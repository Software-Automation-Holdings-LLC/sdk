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
import type { Concept, ConceptKind } from './Concept.js';
import { Sort } from './Sort.js';
import { type Suggestion } from './Suggestion.js';
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
export declare class DefaultAutocompleteAlgorithm implements AutocompleteAlgorithm {
    private readonly startOnly;
    private readonly _versionTag;
    constructor(opts?: DefaultAutocompleteAlgorithmOptions);
    /** Opaque tag tracking the version of this ranker. */
    get versionTag(): string | undefined;
    rank(query: string, candidates: readonly Concept[], options: AutocompleteOptions): Promise<Suggestion[]>;
    /** Return a new ranker with selected fields overridden. */
    clone(overrides?: Partial<DefaultAutocompleteAlgorithmOptions>): DefaultAutocompleteAlgorithm;
}
//# sourceMappingURL=AutocompleteAlgorithm.d.ts.map