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
import type { Concept, UnknownConcept } from './Concept.js';
import type { MatchAlgorithm } from './MatchAlgorithm.js';
/** Constructor options for {@link FuzzyMatchAlgorithm}. */
export interface FuzzyMatchAlgorithmOptions {
    /**
     * Per-id popularity map (concept `id` → aggregate count). Drives the
     * intra-tier frequency tie-break. Conventionally sourced from
     * `isa.zyins.datasets`' `buildFrequencyMap`. Omit to disable frequency
     * ranking; ties then fall through to the deterministic name/id order.
     */
    readonly frequencies?: ReadonlyMap<string, number>;
    /** Optional version stamp surfaced via {@link FuzzyMatchAlgorithm.versionTag}. */
    readonly versionTag?: string;
}
export declare class FuzzyMatchAlgorithm implements MatchAlgorithm {
    private readonly frequencies;
    private readonly _versionTag;
    /** Cache of candidate primary metaphone codes, keyed by candidate-pool identity. */
    private metaphoneCache;
    constructor(opts?: FuzzyMatchAlgorithmOptions);
    /** Opaque tag tracking the version of this matcher / its frequency map. */
    get versionTag(): string | undefined;
    match(query: string, candidates: readonly Concept[]): Concept | UnknownConcept;
    /** Return a new matcher with selected fields overridden. */
    clone(overrides?: Partial<FuzzyMatchAlgorithmOptions>): FuzzyMatchAlgorithm;
    /**
     * Evaluate tiers in order; return the candidates of the first tier with
     * any hit, or `undefined` if every tier is empty.
     */
    private firstNonEmptyTier;
    /**
     * Pick the single winner within a tier: lowest edit distance, then
     * highest frequency, then the deterministic name/id tie-break.
     */
    private bestInTier;
    private outranks;
    private frequencyOf;
    private collectPhonetic;
    /** Lazily pre-compute (and cache) each candidate's primary metaphone code. */
    private candidateCodes;
}
//# sourceMappingURL=FuzzyMatchAlgorithm.d.ts.map