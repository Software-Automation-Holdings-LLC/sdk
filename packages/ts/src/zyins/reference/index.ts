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
import { buildFrequencyMap, buildTypoMap } from '../datasets-v3';
import { ReferenceIndex, buildUnknownConcept } from './referenceIndex';
import { Sort } from './Sort';
import { type Concept, type ConceptKind, type ConditionConcept, type MedicationConcept, type UnknownConcept } from './Concept';
import { type Autocorrector, type AutocorrectOptions, DefaultAutocorrector } from './Autocorrector';
import { type MatchAlgorithm, DefaultMatchAlgorithm } from './MatchAlgorithm';
import { type AutocompleteAlgorithm, type AutocompleteOptions, DefaultAutocompleteAlgorithm } from './AutocompleteAlgorithm';
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
export class ReferenceBundleCache {
    private bundle: DatasetBundleV3 | undefined;
    private index: ReferenceIndex | undefined;
    private typoMap: ReadonlyMap<string, string> | undefined;
    private frequencyMap: ReadonlyMap<string, number> | undefined;

    /** Push the freshly-fetched bundle. */
    setBundle(bundle: DatasetBundleV3): void {
        if (this.bundle === bundle) return;
        if (this.bundle !== undefined && sameVersion(this.bundle, bundle)) {
            return;
        }
        this.bundle = bundle;
        this.index = undefined;
        this.typoMap = undefined;
        this.frequencyMap = undefined;
        bundleGenerations.set(this, (bundleGenerations.get(this) ?? 0) + 1);
    }

    /** Read the active index, building it on demand. */
    currentIndex(): ReferenceIndex | undefined {
        if (this.bundle === undefined) return undefined;
        if (this.index === undefined) {
            this.index = new ReferenceIndex(this.bundle);
        }
        return this.index;
    }

    /** Read (build-on-demand) the bundle-derived typo map. */
    currentTypoMap(): ReadonlyMap<string, string> {
        if (this.bundle === undefined) return EMPTY_MAP;
        if (this.typoMap === undefined) {
            this.typoMap = buildTypoMap(this.bundle);
        }
        return this.typoMap;
    }

    /** Read (build-on-demand) the per-id aggregate frequency map. */
    currentFrequencyMap(): ReadonlyMap<string, number> {
        if (this.bundle === undefined) return EMPTY_NUM_MAP;
        if (this.frequencyMap === undefined) {
            this.frequencyMap = buildFrequencyMap(this.bundle);
        }
        return this.frequencyMap;
    }

    /** Read the active bundle version signal (etag-or-version). */
    currentVersionTag(): string | undefined {
        if (this.bundle === undefined) return undefined;
        return bundleVersionTag(this.bundle) ?? `${UNVERSIONED_BUNDLE_TAG_PREFIX}:${bundleGenerations.get(this) ?? 0}`;
    }
}

const EMPTY_MAP: ReadonlyMap<string, string> = new Map();
const EMPTY_NUM_MAP: ReadonlyMap<string, number> = new Map();
const UNVERSIONED_BUNDLE_TAG_PREFIX = 'unversioned';
const bundleGenerations = new WeakMap<ReferenceBundleCache, number>();
const defaultFastPathFacades = new WeakSet<object>();

function sameVersion(a: DatasetBundleV3, b: DatasetBundleV3): boolean {
    const aVersion = bundleVersionTag(a);
    const bVersion = bundleVersionTag(b);
    return aVersion !== undefined && bVersion !== undefined && aVersion === bVersion;
}

function bundleVersionTag(bundle: DatasetBundleV3): string | undefined {
    if (bundle.etag !== undefined && bundle.etag !== '') return bundle.etag;
    if (bundle.version !== '') return bundle.version;
    return undefined;
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
export class ReferenceFacade {
    /** Namespaced sort enum. `Sort.MostCommonFirst | Alphabetical`. */
    public static readonly Sort = Sort;
    /** Instance accessor for `Sort`. */
    public readonly Sort = Sort;

    public readonly medications: ReferenceMedicationsFacade;
    public readonly conditions: ReferenceConditionsFacade;
    public readonly concepts: ReferenceConceptsFacade;

    /** Domain-bound autocorrector. Pre-wired to the bundle's spelling table. */
    public readonly autocorrector: Autocorrector;
    /** Domain-bound matcher. Pre-wired to the bundle's catalog. */
    public readonly matcher: MatchAlgorithm;

    constructor(
        private readonly cache: ReferenceBundleCache,
        adapters: ReferenceAdapters = {},
    ) {
        this.autocorrector = adapters.autocorrector ?? new BundleBoundAutocorrector(cache);
        this.matcher = adapters.matchAlgorithm ?? new DefaultMatchAlgorithm();
        const useDefaultFastPath = adapters.matchAlgorithm === undefined;
        const ranker = adapters.autocompleteAlgorithm ?? new DefaultAutocompleteAlgorithm();
        this.medications = new ReferenceMedicationsFacade(cache, this.matcher, ranker);
        this.conditions = new ReferenceConditionsFacade(cache, this.matcher, ranker);
        this.concepts = new ReferenceConceptsFacade(cache, this.matcher, ranker);
        if (useDefaultFastPath) {
            defaultFastPathFacades.add(this.medications);
            defaultFastPathFacades.add(this.conditions);
            defaultFastPathFacades.add(this.concepts);
        }
    }
}

/**
 * Adapter that delegates to a fresh {@link DefaultAutocorrector} per
 * call, rebuilding the typo map only when the bundle version changes.
 * Lets `isa.zyins.autocorrector` track bundle refreshes without consumer
 * plumbing.
 */
class BundleBoundAutocorrector implements Autocorrector {
    private cached: DefaultAutocorrector | undefined;
    private cachedVersion: string | undefined;

    constructor(private readonly cache: ReferenceBundleCache) {}

    correct(text: string, options: AutocorrectOptions): string {
        return this.current().correct(text, options);
    }

    private current(): DefaultAutocorrector {
        const version = this.cache.currentVersionTag();
        if (this.cached !== undefined && version === this.cachedVersion) return this.cached;
        this.cached = new DefaultAutocorrector({
            typoMap: this.cache.currentTypoMap(),
            ...(version !== undefined && { versionTag: version }),
        });
        this.cachedVersion = version;
        return this.cached;
    }
}

/** `isa.zyins.reference.medications` / `isa.zyins.medications`. */
export class ReferenceMedicationsFacade {
    constructor(
        private readonly cache: ReferenceBundleCache,
        private readonly matcher: MatchAlgorithm,
        private readonly ranker: AutocompleteAlgorithm,
    ) {}

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
    match(text: string): MedicationConcept | UnknownConcept {
        const idx = this.cache.currentIndex();
        if (idx === undefined) return buildUnknownConcept(text);
        if (defaultFastPathFacades.has(this)) {
            return idx.lookupMedication(text);
        }
        const candidates = idx.listMedications();
        const result = this.matcher.match(text, candidates);
        if (!result.isKnown) return buildUnknownConcept(text);
        if (result.kind !== 'medication') return buildUnknownConcept(text);
        return idx.lookupResolvedConcept(result, text) as MedicationConcept;
    }

    /**
     * Rank medications against `query`. Default: bucketed frequency boost.
     *
     * @example
     * ```ts
     * const top5 = await isa.zyins.medications.autocomplete('lisi', { limit: 5 });
     * ```
     */
    async autocomplete(query: string, options: Partial<AutocompleteOptions> = {}): Promise<Suggestion[]> {
        const idx = this.cache.currentIndex();
        if (idx === undefined) return [];
        return this.ranker.rank(query, idx.listMedications(), {
            limit: options.limit ?? DEFAULT_LIMIT,
            kinds: options.kinds ?? ['medication'],
            frequencies: options.frequencies ?? this.cache.currentFrequencyMap(),
            ...(options.sort !== undefined && { sort: options.sort }),
        });
    }

    /** Enumerate every known medication. Empty until the bundle is primed. */
    list(): MedicationConcept[] {
        const idx = this.cache.currentIndex();
        if (idx === undefined) return [];
        return idx.listMedications();
    }
}

/** `isa.zyins.reference.conditions` / `isa.zyins.conditions`. */
export class ReferenceConditionsFacade {
    constructor(
        private readonly cache: ReferenceBundleCache,
        private readonly matcher: MatchAlgorithm,
        private readonly ranker: AutocompleteAlgorithm,
    ) {}

    match(text: string): ConditionConcept | UnknownConcept {
        const idx = this.cache.currentIndex();
        if (idx === undefined) return buildUnknownConcept(text);
        if (defaultFastPathFacades.has(this)) {
            return idx.lookupCondition(text);
        }
        const candidates = idx.listConditions();
        const result = this.matcher.match(text, candidates);
        if (!result.isKnown) return buildUnknownConcept(text);
        if (result.kind !== 'condition') return buildUnknownConcept(text);
        return idx.lookupResolvedConcept(result, text) as ConditionConcept;
    }

    async autocomplete(query: string, options: Partial<AutocompleteOptions> = {}): Promise<Suggestion[]> {
        const idx = this.cache.currentIndex();
        if (idx === undefined) return [];
        return this.ranker.rank(query, idx.listConditions(), {
            limit: options.limit ?? DEFAULT_LIMIT,
            kinds: options.kinds ?? ['condition'],
            frequencies: options.frequencies ?? this.cache.currentFrequencyMap(),
            ...(options.sort !== undefined && { sort: options.sort }),
        });
    }

    list(): ConditionConcept[] {
        const idx = this.cache.currentIndex();
        if (idx === undefined) return [];
        return idx.listConditions();
    }
}

/** `isa.zyins.reference.concepts`. */
export class ReferenceConceptsFacade {
    constructor(
        private readonly cache: ReferenceBundleCache,
        private readonly matcher: MatchAlgorithm,
        private readonly ranker: AutocompleteAlgorithm,
    ) {}

    match(text: string): Concept {
        const idx = this.cache.currentIndex();
        if (idx === undefined) return buildUnknownConcept(text);
        if (defaultFastPathFacades.has(this)) return idx.lookupConcept(text);
        const candidates: Concept[] = [...idx.listConditions(), ...idx.listMedications()];
        return idx.lookupResolvedConcept(this.matcher.match(text, candidates), text);
    }

    matchMany(texts: readonly string[]): Concept[] {
        const idx = this.cache.currentIndex();
        if (idx === undefined) return texts.map((t) => buildUnknownConcept(t));
        if (defaultFastPathFacades.has(this)) {
            return texts.map((t) => idx.lookupConcept(t));
        }
        const candidates: Concept[] = [...idx.listConditions(), ...idx.listMedications()];
        return texts.map((t) => idx.lookupResolvedConcept(this.matcher.match(t, candidates), t));
    }

    /**
     * Rank across all concept kinds. Pass `kinds` to narrow; omit for both.
     */
    async autocomplete(query: string, options: Partial<AutocompleteOptions> = {}): Promise<Suggestion[]> {
        const idx = this.cache.currentIndex();
        if (idx === undefined) return [];
        const candidates: Concept[] = [...idx.listConditions(), ...idx.listMedications()];
        return this.ranker.rank(query, candidates, {
            limit: options.limit ?? DEFAULT_LIMIT,
            kinds: options.kinds ?? [],
            frequencies: options.frequencies ?? this.cache.currentFrequencyMap(),
            ...(options.sort !== undefined && { sort: options.sort }),
        });
    }
}

const DEFAULT_LIMIT = 25;

// Re-export public types for consumers reaching them via the namespace.
export { Sort } from './Sort';
export type { Concept, ConceptKind, ConditionConcept, MedicationConcept, UnknownConcept } from './Concept';
export { type Autocorrector, type AutocorrectOptions, type AutocorrectAppliedEvent, type DefaultAutocorrectorOptions, DefaultAutocorrector } from './Autocorrector';
export { type MatchAlgorithm, type DefaultMatchAlgorithmOptions, DefaultMatchAlgorithm } from './MatchAlgorithm';
export { type AutocompleteAlgorithm, type AutocompleteOptions, type DefaultAutocompleteAlgorithmOptions, DefaultAutocompleteAlgorithm } from './AutocompleteAlgorithm';
export { type Suggestion, buildSuggestion } from './Suggestion';
