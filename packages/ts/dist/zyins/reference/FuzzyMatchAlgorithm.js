/**
 * `FuzzyMatchAlgorithm` — typo-tolerant text → single Concept resolution.
 *
 * An opt-in {@link MatchAlgorithm} that recovers misspellings the
 * {@link DefaultMatchAlgorithm} (exact `make_key` + word-order-invariant
 * `check_key`) cannot. The default stays the default; pass this to
 * `Isa.withKeycode({ matchAlgorithm: new FuzzyMatchAlgorithm() })` to opt in.
 *
 * Pipeline — a tiered cascade, ranked by TIER FIRST, then by candidate
 * frequency (Algolia-style successive tie-break, NOT one blended score):
 *
 *   1. exact      — `make_key` id/name equality (identity-preserving)
 *   2. prefix     — candidate key starts with the query key (or vice versa)
 *   3. damerau    — OSA edit distance within a length-scaled band
 *                   (`sertaline` → `sertraline`, `chrons` → `crohns`)
 *   4. phonetic   — Double Metaphone primary-code equality
 *                   (`tylonol` → `tylenol`, both encode `TLNL`)
 *   5. synonym    — alias equality, only if the Concept exposes `aliases`
 *                   (today's {@link Concept} does NOT — tier is skipped)
 *
 * The first non-empty tier wins; within it the best candidate is chosen by
 * frequency (higher first), then a deterministic name/id tie-break so the
 * result is reproducible across the Go / PHP / C# / Python ports.
 *
 * Frequency is NOT a field on {@link Concept} — it lives in a separate
 * per-id map the catalog builds (`buildFrequencyMap`). Supply it via
 * {@link FuzzyMatchAlgorithmOptions.frequencies}; omit it and the frequency
 * tie-break is skipped (tier + edit-distance + name/id still order the
 * result deterministically).
 *
 * Parity-hardening rules (the cross-language determinism contract):
 *   1. Both query and every candidate string are NFC-normalized before any
 *      comparison.
 *   2. Lowercasing is locale-invariant. JS `toLowerCase()` is already
 *      locale-independent; the Go/PHP/C#/Python ports MUST use invariant
 *      culture (Go `strings.ToLower`, C# `ToLowerInvariant`, etc.).
 *   3. When tier + edit distance + frequency are all equal, ties break by
 *      normalized candidate name, then `id` — stable, reproducible output.
 *   4. The Double Metaphone encoder is validated against a shared vector
 *      fixture (`doubleMetaphone.vectors.ts`) reused by every port.
 *
 * Synchronous, pure, dependency-free, and safe to share across concurrent
 * calls — the instance holds no mutable per-call state. Candidate metaphone
 * codes are pre-computed lazily per candidate-pool identity for speed.
 *
 * @example
 * ```ts
 * const matcher = new FuzzyMatchAlgorithm({ frequencies });
 * matcher.match('sertaline', medications).id; // 'SERTRALINE'
 * matcher.match('tylonol', medications).id;    // 'TYLENOL'
 * ```
 */
import { _makeKey } from './_makeKey.js';
import { buildUnknownConcept } from './referenceIndex.js';
import { doubleMetaphone } from './_doubleMetaphone.js';
import { fuzzyThresholdForLength, optimalStringAlignmentDistance, } from './_damerauOsa.js';
/** Ranked cascade tiers. Lower ordinal = stronger match. */
var Tier;
(function (Tier) {
    Tier[Tier["Exact"] = 0] = "Exact";
    Tier[Tier["Prefix"] = 1] = "Prefix";
    Tier[Tier["Damerau"] = 2] = "Damerau";
    Tier[Tier["Phonetic"] = 3] = "Phonetic";
    Tier[Tier["Synonym"] = 4] = "Synonym";
})(Tier || (Tier = {}));
export class FuzzyMatchAlgorithm {
    frequencies;
    _versionTag;
    /** Cache of candidate primary metaphone codes, keyed by candidate-pool identity. */
    metaphoneCache = new WeakMap();
    constructor(opts = {}) {
        this.frequencies = opts.frequencies ?? EMPTY_FREQUENCIES;
        this._versionTag = opts.versionTag;
    }
    /** Opaque tag tracking the version of this matcher / its frequency map. */
    get versionTag() {
        return this._versionTag;
    }
    match(query, candidates) {
        const queryKey = _makeKey(query);
        if (!queryKey)
            return buildUnknownConcept(query);
        const tier = this.firstNonEmptyTier(query, queryKey, candidates);
        if (tier === undefined)
            return buildUnknownConcept(query);
        const winner = this.bestInTier(tier);
        return winner ?? buildUnknownConcept(query);
    }
    /** Return a new matcher with selected fields overridden. */
    clone(overrides = {}) {
        const nextVersionTag = overrides.versionTag ?? this._versionTag;
        return new FuzzyMatchAlgorithm({
            frequencies: overrides.frequencies ?? this.frequencies,
            ...(nextVersionTag !== undefined && { versionTag: nextVersionTag }),
        });
    }
    /**
     * Evaluate tiers in order; return the candidates of the first tier with
     * any hit, or `undefined` if every tier is empty.
     */
    firstNonEmptyTier(query, queryKey, candidates) {
        const exact = collectExact(queryKey, candidates);
        if (exact.length > 0)
            return exact;
        const prefix = collectPrefix(queryKey, candidates);
        if (prefix.length > 0)
            return prefix;
        const damerau = collectDamerau(queryKey, candidates);
        if (damerau.length > 0)
            return damerau;
        const phonetic = this.collectPhonetic(query, candidates);
        if (phonetic.length > 0)
            return phonetic;
        const synonym = collectSynonym(query, candidates);
        if (synonym.length > 0)
            return synonym;
        return undefined;
    }
    /**
     * Pick the single winner within a tier: lowest edit distance, then
     * highest frequency, then the deterministic name/id tie-break.
     */
    bestInTier(tier) {
        let best;
        for (const candidate of tier) {
            if (best === undefined || this.outranks(candidate, best))
                best = candidate;
        }
        return best?.concept;
    }
    outranks(a, b) {
        if (a.distance !== b.distance)
            return a.distance < b.distance;
        const aFreq = this.frequencyOf(a.concept);
        const bFreq = this.frequencyOf(b.concept);
        if (aFreq !== bFreq)
            return aFreq > bFreq;
        return compareForTieBreak(a.concept, b.concept) < 0;
    }
    frequencyOf(concept) {
        if (concept.id === null)
            return 0;
        return this.frequencies.get(concept.id) ?? 0;
    }
    collectPhonetic(query, candidates) {
        const queryCode = doubleMetaphone(normalizeForCompare(query)).primary;
        if (queryCode === '')
            return [];
        const codes = this.candidateCodes(candidates);
        const hits = [];
        for (const candidate of candidates) {
            if (codes.get(candidate) === queryCode)
                hits.push({ concept: candidate, distance: 0 });
        }
        return hits;
    }
    /** Lazily pre-compute (and cache) each candidate's primary metaphone code. */
    candidateCodes(candidates) {
        const cached = this.metaphoneCache.get(candidates);
        if (cached !== undefined)
            return cached;
        const codes = new Map();
        for (const candidate of candidates) {
            codes.set(candidate, doubleMetaphone(normalizeForCompare(candidate.name)).primary);
        }
        this.metaphoneCache.set(candidates, codes);
        return codes;
    }
}
const EMPTY_FREQUENCIES = new Map();
/**
 * NFC-normalize, then locale-invariant lowercase. Rule 1 + Rule 2 of the
 * parity-hardening contract: `café` (precomposed) and `café`
 * (decomposed) collapse to the same string before any comparison.
 */
function normalizeForCompare(text) {
    return text.normalize('NFC').toLowerCase();
}
function collectExact(queryKey, candidates) {
    const hits = [];
    for (const candidate of candidates) {
        if (_makeKey(candidate.name) === queryKey) {
            hits.push({ concept: candidate, distance: 0 });
            continue;
        }
        if (candidate.id !== null && _makeKey(candidate.id) === queryKey) {
            hits.push({ concept: candidate, distance: 0 });
        }
    }
    return hits;
}
function collectPrefix(queryKey, candidates) {
    const hits = [];
    for (const candidate of candidates) {
        const nameKey = _makeKey(candidate.name);
        if (nameKey === queryKey)
            continue; // exact, not prefix
        if (nameKey.startsWith(queryKey) || queryKey.startsWith(nameKey)) {
            hits.push({ concept: candidate, distance: Math.abs(nameKey.length - queryKey.length) });
        }
    }
    return hits;
}
function collectDamerau(queryKey, candidates) {
    const threshold = fuzzyThresholdForLength(queryKey.length);
    const hits = [];
    for (const candidate of candidates) {
        const nameKey = _makeKey(candidate.name);
        if (nameKey === '' || nameKey === queryKey)
            continue;
        const distance = optimalStringAlignmentDistance(queryKey, nameKey, threshold);
        if (distance <= threshold)
            hits.push({ concept: candidate, distance });
    }
    return hits;
}
/**
 * Alias tier. Inert until {@link Concept} surfaces `aliases`; reads them
 * defensively so the cross-language contract is one signature, not a future
 * breaking change.
 */
function collectSynonym(query, candidates) {
    const queryKey = _makeKey(query);
    const hits = [];
    for (const candidate of candidates) {
        const aliases = candidate.aliases;
        if (aliases === undefined)
            continue;
        if (aliases.some((alias) => _makeKey(alias) === queryKey)) {
            hits.push({ concept: candidate, distance: 0 });
        }
    }
    return hits;
}
/**
 * Rule 3: deterministic final tie-break by normalized name, then `id`.
 * `null` ids (never reached for known candidates) sort last so the order is
 * total. Uses code-unit ordering — NOT `localeCompare` — so the comparison
 * is locale-invariant and identical across the language ports.
 */
function compareForTieBreak(a, b) {
    const aName = normalizeForCompare(a.name);
    const bName = normalizeForCompare(b.name);
    if (aName < bName)
        return -1;
    if (aName > bName)
        return 1;
    const aId = a.id ?? '￿';
    const bId = b.id ?? '￿';
    if (aId < bId)
        return -1;
    if (aId > bId)
        return 1;
    return 0;
}
//# sourceMappingURL=FuzzyMatchAlgorithm.js.map