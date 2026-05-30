/**
 * `isa.zyins.reference` — typed reference catalog access.
 *
 * Three pluggable adapters back this facade:
 *   - {@link Autocorrector} — `correct(text, { mode })`. Default: ngram
 *     sliding window over the bundle's `spellingCorrections`.
 *   - {@link MatchAlgorithm} — `match(text, candidates)`. Default:
 *     `make_key` normalize + exact lookup.
 *   - {@link AutocompleteAlgorithm} — `rank(text, candidates, options)`.
 *     Default: bucketed frequency-boost (ported from the bpp2.0 picker).
 *
 * All three default to the bundle-bound implementations; consumers swap
 * any of them via the `Isa.withKeycode` constructor options.
 *
 * @example
 * ```ts
 * const isa = await Isa.withKeycode({
 *   keycode, email,
 *   autocompleteAlgorithm: new MyEmbeddingRanker(),
 * });
 * const ranked = await isa.zyins.medications.autocomplete('lisi', { limit: 5 });
 * ```
 */
import type { DatasetBundleV3 } from '../datasets-v3';
import { ReferenceIndex } from './referenceIndex';
import { type Concept, type ConditionConcept, type MedicationConcept, type UnknownConcept } from './Concept';
import { type Autocorrector } from './Autocorrector';
import { type MatchAlgorithm } from './MatchAlgorithm';
import { type AutocompleteAlgorithm, type AutocompleteOptions } from './AutocompleteAlgorithm';
import { type Suggestion } from './Suggestion';
/**
 * Shared bundle cache. One instance per `ZyInsNamespace`; the
 * `DatasetsFacade.getV3()` call writes the latest bundle here, and the
 * `ReferenceFacade` reads from it lazily.
 *
 * The cache also memoizes the derived typo map + frequency map so
 * repeated `autocorrector.correct()` / `autocomplete()` calls do not
 * rebuild them per call.
 */
export declare class ReferenceBundleCache {
    private bundle;
    private index;
    private typoMap;
    private frequencyMap;
    /** Push the freshly-fetched bundle. */
    setBundle(bundle: DatasetBundleV3): void;
    /** Read the active index, building it on demand. */
    currentIndex(): ReferenceIndex | undefined;
    /** Read (build-on-demand) the bundle-derived typo map. */
    currentTypoMap(): ReadonlyMap<string, string>;
    /** Read (build-on-demand) the per-id aggregate frequency map. */
    currentFrequencyMap(): ReadonlyMap<string, number>;
    /** Read the active bundle version signal (etag-or-version). */
    currentVersionTag(): string | undefined;
}
/** Adapter overrides accepted by {@link ReferenceFacade}. */
export interface ReferenceAdapters {
    /** Replace the default autocorrector. Omit to use the bundle-bound default. */
    readonly autocorrector?: Autocorrector;
    /** Replace the default matcher. */
    readonly matchAlgorithm?: MatchAlgorithm;
    /** Replace the default ranker. */
    readonly autocompleteAlgorithm?: AutocompleteAlgorithm;
}
/**
 * The `isa.zyins.reference` facade.
 *
 * Construction takes a `ReferenceBundleCache` shared with `DatasetsFacade`
 * — the namespace wires them up so `datasets.getV3()` warms `reference`
 * automatically; no consumer-side plumbing.
 */
export declare class ReferenceFacade {
    private readonly cache;
    /** Namespaced sort enum. `Sort.MostCommonFirst | Alphabetical`. */
    static readonly Sort: Readonly<{
        readonly MostCommonFirst: "most_common_first";
        readonly Alphabetical: "alphabetical";
    }>;
    /** Instance accessor for `Sort`. */
    readonly Sort: Readonly<{
        readonly MostCommonFirst: "most_common_first";
        readonly Alphabetical: "alphabetical";
    }>;
    readonly medications: ReferenceMedicationsFacade;
    readonly conditions: ReferenceConditionsFacade;
    readonly concepts: ReferenceConceptsFacade;
    /** Domain-bound autocorrector. Pre-wired to the bundle's spelling table. */
    readonly autocorrector: Autocorrector;
    /** Domain-bound matcher. Pre-wired to the bundle's catalog. */
    readonly matcher: MatchAlgorithm;
    constructor(cache: ReferenceBundleCache, adapters?: ReferenceAdapters);
}
/** `isa.zyins.reference.medications` / `isa.zyins.medications`. */
export declare class ReferenceMedicationsFacade {
    private readonly cache;
    private readonly matcher;
    private readonly ranker;
    constructor(cache: ReferenceBundleCache, matcher: MatchAlgorithm, ranker: AutocompleteAlgorithm);
    /**
     * Resolve free text to a single medication. Sync; never throws.
     * Unknown input or unprimed bundle returns an `UnknownConcept` with
     * `inputText` preserved.
     *
     * @example
     * ```ts
     * const med = isa.zyins.medications.match('lisinopril');
     * for (const cond of med.conditions(Sort.MostCommonFirst)) console.log(cond.name);
     * ```
     */
    match(text: string): MedicationConcept | UnknownConcept;
    /**
     * Rank medications against `query`. Default: bucketed frequency boost.
     *
     * @example
     * ```ts
     * const top5 = await isa.zyins.medications.autocomplete('lisi', { limit: 5 });
     * ```
     */
    autocomplete(query: string, options?: Partial<AutocompleteOptions>): Promise<Suggestion[]>;
    /** Enumerate every known medication. Empty until the bundle is primed. */
    list(): MedicationConcept[];
}
/** `isa.zyins.reference.conditions` / `isa.zyins.conditions`. */
export declare class ReferenceConditionsFacade {
    private readonly cache;
    private readonly matcher;
    private readonly ranker;
    constructor(cache: ReferenceBundleCache, matcher: MatchAlgorithm, ranker: AutocompleteAlgorithm);
    match(text: string): ConditionConcept | UnknownConcept;
    autocomplete(query: string, options?: Partial<AutocompleteOptions>): Promise<Suggestion[]>;
    list(): ConditionConcept[];
}
/** `isa.zyins.reference.concepts`. */
export declare class ReferenceConceptsFacade {
    private readonly cache;
    private readonly matcher;
    private readonly ranker;
    constructor(cache: ReferenceBundleCache, matcher: MatchAlgorithm, ranker: AutocompleteAlgorithm);
    match(text: string): Concept;
    matchMany(texts: readonly string[]): Concept[];
    /**
     * Rank across all concept kinds. Pass `kinds` to narrow; omit for both.
     */
    autocomplete(query: string, options?: Partial<AutocompleteOptions>): Promise<Suggestion[]>;
}
export { Sort } from './Sort';
export type { Concept, ConceptKind, ConditionConcept, MedicationConcept, UnknownConcept } from './Concept';
export { type Autocorrector, type AutocorrectOptions, type AutocorrectAppliedEvent, type DefaultAutocorrectorOptions, DefaultAutocorrector } from './Autocorrector';
export { type MatchAlgorithm, type DefaultMatchAlgorithmOptions, DefaultMatchAlgorithm } from './MatchAlgorithm';
export { type AutocompleteAlgorithm, type AutocompleteOptions, type DefaultAutocompleteAlgorithmOptions, DefaultAutocompleteAlgorithm } from './AutocompleteAlgorithm';
export { type Suggestion, buildSuggestion } from './Suggestion';
//# sourceMappingURL=index.d.ts.map