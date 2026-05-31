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
import { buildFrequencyMap, buildTypoMap } from '../datasets-v3.js';
import { ReferenceIndex, buildUnknownConcept } from './referenceIndex.js';
import { Sort } from './Sort.js';
import { DefaultAutocorrector } from './Autocorrector.js';
import { DefaultMatchAlgorithm } from './MatchAlgorithm.js';
import { DefaultAutocompleteAlgorithm } from './AutocompleteAlgorithm.js';
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
    bundle;
    index;
    typoMap;
    frequencyMap;
    /** Push the freshly-fetched bundle. */
    setBundle(bundle) {
        if (this.bundle === bundle)
            return;
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
    currentIndex() {
        if (this.bundle === undefined)
            return undefined;
        if (this.index === undefined) {
            this.index = new ReferenceIndex(this.bundle);
        }
        return this.index;
    }
    /** Read (build-on-demand) the bundle-derived typo map. */
    currentTypoMap() {
        if (this.bundle === undefined)
            return EMPTY_MAP;
        if (this.typoMap === undefined) {
            this.typoMap = buildTypoMap(this.bundle);
        }
        return this.typoMap;
    }
    /** Read (build-on-demand) the per-id aggregate frequency map. */
    currentFrequencyMap() {
        if (this.bundle === undefined)
            return EMPTY_NUM_MAP;
        if (this.frequencyMap === undefined) {
            this.frequencyMap = buildFrequencyMap(this.bundle);
        }
        return this.frequencyMap;
    }
    /** Read the active bundle version signal (etag-or-version). */
    currentVersionTag() {
        if (this.bundle === undefined)
            return undefined;
        return bundleVersionTag(this.bundle) ?? `${UNVERSIONED_BUNDLE_TAG_PREFIX}:${bundleGenerations.get(this) ?? 0}`;
    }
}
const EMPTY_MAP = new Map();
const EMPTY_NUM_MAP = new Map();
const UNVERSIONED_BUNDLE_TAG_PREFIX = 'unversioned';
const bundleGenerations = new WeakMap();
const defaultFastPathFacades = new WeakSet();
function sameVersion(a, b) {
    const aVersion = bundleVersionTag(a);
    const bVersion = bundleVersionTag(b);
    return aVersion !== undefined && bVersion !== undefined && aVersion === bVersion;
}
function bundleVersionTag(bundle) {
    if (bundle.etag !== undefined && bundle.etag !== '')
        return bundle.etag;
    if (bundle.version !== '')
        return bundle.version;
    return undefined;
}
/**
 * The `isa.zyins.reference` facade.
 *
 * Construction takes a `ReferenceBundleCache` shared with `DatasetsFacade`
 * — the namespace wires them up so `datasets.getV3()` warms `reference`
 * automatically; no consumer-side plumbing.
 */
export class ReferenceFacade {
    cache;
    /** Namespaced sort enum. `Sort.MostCommonFirst | Alphabetical`. */
    static Sort = Sort;
    /** Instance accessor for `Sort`. */
    Sort = Sort;
    medications;
    conditions;
    concepts;
    /** Domain-bound autocorrector. Pre-wired to the bundle's spelling table. */
    autocorrector;
    /** Domain-bound matcher. Pre-wired to the bundle's catalog. */
    matcher;
    constructor(cache, adapters = {}) {
        this.cache = cache;
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
class BundleBoundAutocorrector {
    cache;
    cached;
    cachedVersion;
    constructor(cache) {
        this.cache = cache;
    }
    correct(text, options) {
        return this.current().correct(text, options);
    }
    current() {
        const version = this.cache.currentVersionTag();
        if (this.cached !== undefined && version === this.cachedVersion)
            return this.cached;
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
    cache;
    matcher;
    ranker;
    constructor(cache, matcher, ranker) {
        this.cache = cache;
        this.matcher = matcher;
        this.ranker = ranker;
    }
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
    match(text) {
        const idx = this.cache.currentIndex();
        if (idx === undefined)
            return buildUnknownConcept(text);
        if (defaultFastPathFacades.has(this)) {
            return idx.lookupMedication(text);
        }
        const candidates = idx.listMedications();
        const result = this.matcher.match(text, candidates);
        if (!result.isKnown)
            return buildUnknownConcept(text);
        if (result.kind !== 'medication')
            return buildUnknownConcept(text);
        return idx.lookupResolvedConcept(result, text);
    }
    /**
     * Rank medications against `query`. Default: bucketed frequency boost.
     *
     * @example
     * ```ts
     * const top5 = await isa.zyins.medications.autocomplete('lisi', { limit: 5 });
     * ```
     */
    async autocomplete(query, options = {}) {
        const idx = this.cache.currentIndex();
        if (idx === undefined)
            return [];
        return this.ranker.rank(query, idx.listMedications(), {
            limit: options.limit ?? DEFAULT_LIMIT,
            kinds: options.kinds ?? ['medication'],
            frequencies: options.frequencies ?? this.cache.currentFrequencyMap(),
            ...(options.sort !== undefined && { sort: options.sort }),
        });
    }
    /** Enumerate every known medication. Empty until the bundle is primed. */
    list() {
        const idx = this.cache.currentIndex();
        if (idx === undefined)
            return [];
        return idx.listMedications();
    }
}
/** `isa.zyins.reference.conditions` / `isa.zyins.conditions`. */
export class ReferenceConditionsFacade {
    cache;
    matcher;
    ranker;
    constructor(cache, matcher, ranker) {
        this.cache = cache;
        this.matcher = matcher;
        this.ranker = ranker;
    }
    match(text) {
        const idx = this.cache.currentIndex();
        if (idx === undefined)
            return buildUnknownConcept(text);
        if (defaultFastPathFacades.has(this)) {
            return idx.lookupCondition(text);
        }
        const candidates = idx.listConditions();
        const result = this.matcher.match(text, candidates);
        if (!result.isKnown)
            return buildUnknownConcept(text);
        if (result.kind !== 'condition')
            return buildUnknownConcept(text);
        return idx.lookupResolvedConcept(result, text);
    }
    async autocomplete(query, options = {}) {
        const idx = this.cache.currentIndex();
        if (idx === undefined)
            return [];
        return this.ranker.rank(query, idx.listConditions(), {
            limit: options.limit ?? DEFAULT_LIMIT,
            kinds: options.kinds ?? ['condition'],
            frequencies: options.frequencies ?? this.cache.currentFrequencyMap(),
            ...(options.sort !== undefined && { sort: options.sort }),
        });
    }
    list() {
        const idx = this.cache.currentIndex();
        if (idx === undefined)
            return [];
        return idx.listConditions();
    }
}
/** `isa.zyins.reference.concepts`. */
export class ReferenceConceptsFacade {
    cache;
    matcher;
    ranker;
    constructor(cache, matcher, ranker) {
        this.cache = cache;
        this.matcher = matcher;
        this.ranker = ranker;
    }
    match(text) {
        const idx = this.cache.currentIndex();
        if (idx === undefined)
            return buildUnknownConcept(text);
        if (defaultFastPathFacades.has(this))
            return idx.lookupConcept(text);
        const candidates = [...idx.listConditions(), ...idx.listMedications()];
        return idx.lookupResolvedConcept(this.matcher.match(text, candidates), text);
    }
    matchMany(texts) {
        const idx = this.cache.currentIndex();
        if (idx === undefined)
            return texts.map((t) => buildUnknownConcept(t));
        if (defaultFastPathFacades.has(this)) {
            return texts.map((t) => idx.lookupConcept(t));
        }
        const candidates = [...idx.listConditions(), ...idx.listMedications()];
        return texts.map((t) => idx.lookupResolvedConcept(this.matcher.match(t, candidates), t));
    }
    /**
     * Rank across all concept kinds. Pass `kinds` to narrow; omit for both.
     */
    async autocomplete(query, options = {}) {
        const idx = this.cache.currentIndex();
        if (idx === undefined)
            return [];
        const candidates = [...idx.listConditions(), ...idx.listMedications()];
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
export { Sort } from './Sort.js';
export { DefaultAutocorrector } from './Autocorrector.js';
export { DefaultMatchAlgorithm } from './MatchAlgorithm.js';
export { DefaultAutocompleteAlgorithm } from './AutocompleteAlgorithm.js';
export { buildSuggestion } from './Suggestion.js';
//# sourceMappingURL=index.js.map