<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Reference;

use Isa\Sdk\Zyins\Reference\Internal\ConceptHandle;
use Isa\Sdk\Zyins\Reference\Internal\DamerauOsa;
use Isa\Sdk\Zyins\Reference\Internal\DoubleMetaphone;
use Normalizer;

/**
 * `FuzzyMatchAlgorithm` — typo-tolerant text → single concept resolution.
 *
 * An opt-in {@see MatchAlgorithmInterface} that recovers misspellings the
 * {@see DefaultMatchAlgorithm} (exact `make_key` + word-order-invariant
 * `check_key`) cannot. The default stays the default; pass this in via
 * `Isa::withKeycode(matchAlgorithm: new FuzzyMatchAlgorithm())` to opt in.
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
 *   5. synonym    — alias equality (today's {@see ConceptInterface} omits
 *                   aliases, so this tier is inert)
 *
 * The first non-empty tier wins; within it the best candidate is chosen by
 * frequency (higher first), then a deterministic name/id tie-break so the
 * result is reproducible across the Go / TS / C# / Python ports.
 *
 * Frequency is NOT a field on {@see ConceptInterface} — it lives in a
 * separate per-id map. Supply it via the constructor; omit it and the
 * frequency tie-break is skipped (tier + edit-distance + name/id still
 * order the result deterministically).
 *
 * Parity-hardening rules (the cross-language determinism contract):
 *   1. Both query and every candidate string are NFC-normalized before any
 *      comparison.
 *   2. Lowercasing is locale-invariant (`mb_strtolower(..., 'UTF-8')`).
 *   3. When tier + edit distance + frequency are all equal, ties break by
 *      normalized candidate name, then `id()`.
 *   4. The Double Metaphone encoder is validated against the shared 102-term
 *      vector fixture ({@see Internal\DoubleMetaphoneVectors}).
 *
 * Stateless apart from a per-pool metaphone cache, so the instance is safe
 * to share across calls.
 *
 * @example
 *  $matcher = new FuzzyMatchAlgorithm(frequencies: $frequencies);
 *  $matcher->match('sertaline', $medications)->id(); // 'SERTRALINE'
 *  $matcher->match('tylonol', $medications)->id();    // 'TYLENOL'
 */
final class FuzzyMatchAlgorithm implements MatchAlgorithmInterface
{
    /** Sentinel sorting `null` ids last (mirrors the TS `\u{FFFF}` guard). */
    private const NULL_ID_SENTINEL = "\u{FFFF}";

    /** @var array<string, int> Per-id popularity map; empty disables the tier. */
    private readonly array $frequencies;

    /**
     * Per candidate-pool primary-metaphone cache. Keyed by the pool's
     * `spl_object_id` so repeated matches against the same array of
     * concepts reuse the computed codes.
     *
     * @var array<int, array<int, string>>
     */
    private array $metaphoneCache = [];

    /**
     * @param array<string, int> $frequencies Per-id popularity map
     *     (concept `id()` → aggregate count) driving the intra-tier
     *     frequency tie-break. Omit to disable frequency ranking.
     */
    public function __construct(
        array $frequencies = [],
        public readonly ?string $versionTag = null,
    ) {
        $this->frequencies = $frequencies;
    }

    public function match(string $query, array $candidates): ConceptInterface
    {
        $queryKey = MakeKey::normalize($query);
        if ($queryKey === '') {
            return ConceptHandle::unknown($query);
        }

        $tier = $this->firstNonEmptyTier($query, $queryKey, $candidates);
        if ($tier === null) {
            return ConceptHandle::unknown($query);
        }
        return $this->bestInTier($tier) ?? ConceptHandle::unknown($query);
    }

    /**
     * Return a new matcher with selected fields overridden.
     *
     * @param array<string, int>|null $frequencies
     */
    public function clone(?array $frequencies = null, ?string $versionTag = null): self
    {
        return new self(
            frequencies: $frequencies ?? $this->frequencies,
            versionTag: $versionTag ?? $this->versionTag,
        );
    }

    /**
     * Evaluate tiers in order; return the candidates of the first tier with
     * any hit, or `null` if every tier is empty.
     *
     * @param list<ConceptInterface> $candidates
     * @return list<array{concept: ConceptInterface, distance: int}>|null
     */
    private function firstNonEmptyTier(string $query, string $queryKey, array $candidates): ?array
    {
        $exact = $this->collectExact($queryKey, $candidates);
        if ($exact !== []) {
            return $exact;
        }
        $prefix = $this->collectPrefix($queryKey, $candidates);
        if ($prefix !== []) {
            return $prefix;
        }
        $damerau = $this->collectDamerau($queryKey, $candidates);
        if ($damerau !== []) {
            return $damerau;
        }
        $phonetic = $this->collectPhonetic($query, $candidates);
        if ($phonetic !== []) {
            return $phonetic;
        }
        $synonym = $this->collectSynonym($query, $candidates);
        if ($synonym !== []) {
            return $synonym;
        }
        return null;
    }

    /**
     * Pick the single winner within a tier: lowest edit distance, then
     * highest frequency, then the deterministic name/id tie-break.
     *
     * @param list<array{concept: ConceptInterface, distance: int}> $tier
     */
    private function bestInTier(array $tier): ?ConceptInterface
    {
        $best = null;
        foreach ($tier as $candidate) {
            if ($best === null || $this->outranks($candidate, $best)) {
                $best = $candidate;
            }
        }
        return $best['concept'] ?? null;
    }

    /**
     * @param array{concept: ConceptInterface, distance: int} $a
     * @param array{concept: ConceptInterface, distance: int} $b
     */
    private function outranks(array $a, array $b): bool
    {
        if ($a['distance'] !== $b['distance']) {
            return $a['distance'] < $b['distance'];
        }
        $aFreq = $this->frequencyOf($a['concept']);
        $bFreq = $this->frequencyOf($b['concept']);
        if ($aFreq !== $bFreq) {
            return $aFreq > $bFreq;
        }
        return $this->compareForTieBreak($a['concept'], $b['concept']) < 0;
    }

    private function frequencyOf(ConceptInterface $concept): int
    {
        $id = $concept->id();
        if ($id === null) {
            return 0;
        }
        return $this->frequencies[$id] ?? 0;
    }

    /**
     * @param list<ConceptInterface> $candidates
     * @return list<array{concept: ConceptInterface, distance: int}>
     */
    private function collectExact(string $queryKey, array $candidates): array
    {
        $hits = [];
        foreach ($candidates as $candidate) {
            if (MakeKey::normalize($candidate->name()) === $queryKey) {
                $hits[] = ['concept' => $candidate, 'distance' => 0];
                continue;
            }
            $id = $candidate->id();
            if ($id !== null && MakeKey::normalize($id) === $queryKey) {
                $hits[] = ['concept' => $candidate, 'distance' => 0];
            }
        }
        return $hits;
    }

    /**
     * @param list<ConceptInterface> $candidates
     * @return list<array{concept: ConceptInterface, distance: int}>
     */
    private function collectPrefix(string $queryKey, array $candidates): array
    {
        $hits = [];
        foreach ($candidates as $candidate) {
            $nameKey = MakeKey::normalize($candidate->name());
            if ($nameKey === $queryKey) {
                continue; // exact, not prefix
            }
            if (str_starts_with($nameKey, $queryKey) || str_starts_with($queryKey, $nameKey)) {
                $hits[] = [
                    'concept' => $candidate,
                    'distance' => abs(strlen($nameKey) - strlen($queryKey)),
                ];
            }
        }
        return $hits;
    }

    /**
     * @param list<ConceptInterface> $candidates
     * @return list<array{concept: ConceptInterface, distance: int}>
     */
    private function collectDamerau(string $queryKey, array $candidates): array
    {
        $threshold = DamerauOsa::thresholdForLength(strlen($queryKey));
        $hits = [];
        foreach ($candidates as $candidate) {
            $nameKey = MakeKey::normalize($candidate->name());
            if ($nameKey === '' || $nameKey === $queryKey) {
                continue;
            }
            $distance = DamerauOsa::distance($queryKey, $nameKey, $threshold);
            if ($distance <= $threshold) {
                $hits[] = ['concept' => $candidate, 'distance' => $distance];
            }
        }
        return $hits;
    }

    /**
     * @param list<ConceptInterface> $candidates
     * @return list<array{concept: ConceptInterface, distance: int}>
     */
    private function collectPhonetic(string $query, array $candidates): array
    {
        $queryCode = DoubleMetaphone::encode($this->normalizeForCompare($query))[0];
        if ($queryCode === '') {
            return [];
        }
        $codes = $this->candidateCodes($candidates);
        $hits = [];
        foreach ($candidates as $offset => $candidate) {
            if (($codes[$offset] ?? '') === $queryCode) {
                $hits[] = ['concept' => $candidate, 'distance' => 0];
            }
        }
        return $hits;
    }

    /**
     * Lazily pre-compute (and cache) each candidate's primary metaphone
     * code, keyed by candidate-pool object identity.
     *
     * @param list<ConceptInterface> $candidates
     * @return array<int, string>
     */
    private function candidateCodes(array $candidates): array
    {
        $poolKey = $this->poolIdentity($candidates);
        if (isset($this->metaphoneCache[$poolKey])) {
            return $this->metaphoneCache[$poolKey];
        }
        $codes = [];
        foreach ($candidates as $offset => $candidate) {
            $codes[$offset] = DoubleMetaphone::encode($this->normalizeForCompare($candidate->name()))[0];
        }
        $this->metaphoneCache[$poolKey] = $codes;
        return $codes;
    }

    /**
     * Derive a stable cache key for a candidate pool from the object ids of
     * its first and last members and its size — concept handles are reused
     * across calls within one bundle, so this collides only for genuinely
     * identical pools.
     *
     * @param list<ConceptInterface> $candidates
     */
    private function poolIdentity(array $candidates): int
    {
        if ($candidates === []) {
            return 0;
        }
        $first = spl_object_id($candidates[array_key_first($candidates)]);
        $last = spl_object_id($candidates[array_key_last($candidates)]);
        return $first * 1_000_003 + $last + count($candidates);
    }

    /**
     * Alias tier. Inert until {@see ConceptInterface} surfaces aliases;
     * reads them defensively via a marker check so the cross-language
     * contract is one signature, not a future breaking change.
     *
     * @param list<ConceptInterface> $candidates
     * @return list<array{concept: ConceptInterface, distance: int}>
     */
    private function collectSynonym(string $query, array $candidates): array
    {
        $queryKey = MakeKey::normalize($query);
        $hits = [];
        foreach ($candidates as $candidate) {
            $aliases = $this->aliasesOf($candidate);
            if ($aliases === null) {
                continue;
            }
            foreach ($aliases as $alias) {
                if (MakeKey::normalize($alias) === $queryKey) {
                    $hits[] = ['concept' => $candidate, 'distance' => 0];
                    break;
                }
            }
        }
        return $hits;
    }

    /**
     * Defensive alias accessor. The current {@see ConceptInterface} does
     * not expose aliases, so this returns `null` for every shipped concept;
     * when a future concept type adds an `aliases(): list<string>` method
     * the tier lights up without a signature change here.
     *
     * @return list<string>|null
     */
    private function aliasesOf(ConceptInterface $candidate): ?array
    {
        if (! method_exists($candidate, 'aliases')) {
            return null;
        }
        /** @var mixed $aliases */
        $aliases = $candidate->aliases();
        if (! is_array($aliases)) {
            return null;
        }
        $out = [];
        foreach ($aliases as $alias) {
            if (is_string($alias)) {
                $out[] = $alias;
            }
        }
        return $out;
    }

    /**
     * Rule 1 + Rule 2: NFC-normalize, then locale-invariant lowercase, so
     * `café` (precomposed) and `café` (decomposed) collapse to one string
     * before any comparison.
     */
    private function normalizeForCompare(string $text): string
    {
        $normalized = Normalizer::normalize($text, Normalizer::FORM_C);
        if ($normalized === false) {
            $normalized = $text;
        }
        return mb_strtolower($normalized, 'UTF-8');
    }

    /**
     * Rule 3: deterministic final tie-break by normalized name, then
     * `id()`. `null` ids (never reached for known candidates) sort last so
     * the order is total. Byte comparison on NFC-normalized UTF-8 matches
     * the TS code-unit ordering for the ASCII catalog.
     */
    private function compareForTieBreak(ConceptInterface $a, ConceptInterface $b): int
    {
        $aName = $this->normalizeForCompare($a->name());
        $bName = $this->normalizeForCompare($b->name());
        // strcmp — byte comparison, never PHP's numeric-string coercion — so
        // the ordering matches the TS code-unit comparison exactly.
        $nameCmp = strcmp($aName, $bName);
        if ($nameCmp !== 0) {
            return $nameCmp < 0 ? -1 : 1;
        }
        $aId = $a->id() ?? self::NULL_ID_SENTINEL;
        $bId = $b->id() ?? self::NULL_ID_SENTINEL;
        $idCmp = strcmp($aId, $bId);
        return $idCmp < 0 ? -1 : ($idCmp > 0 ? 1 : 0);
    }
}
