<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Reference;

use Isa\Sdk\Zyins\Reference\Internal\ConceptHandle;

/**
 * `isa->zyins->reference->conditions` — free text → condition concept.
 *
 * Two call shapes:
 *
 *   $isa->zyins->conditions->match('hbp');           // bundleless
 *   $isa->zyins->conditions->match('hbp', $bundle);  // explicit
 *
 * The bundleless form reads the cached {@see DatasetBundleV3} stitched
 * onto the matcher by {@see \Isa\Sdk\Zyins\ZyInsClient} (warmed by
 * `datasetsV3->get()`). Before the first dataset fetch, the bundleless
 * form returns an unknown handle — same contract as a catalog miss.
 *
 * Never throws on a miss: unknown text yields a handle with
 * `isKnown() === false`, `inputText()` preserved, and empty accessors.
 *
 * @example
 *  $hbp = $isa->zyins->conditions->match('hbp');
 *  $suggestions = $isa->zyins->conditions->autocomplete('hi', new AutocompleteOptions(limit: 5));
 */
final class ConditionsMatcher implements Matcher
{
    public function __construct(
        private readonly ?ReferenceBundleCache $cache = null,
        private readonly ?MatchAlgorithmInterface $matchAlgorithm = null,
        private readonly ?AutocompleteAlgorithmInterface $autocompleteAlgorithm = null,
    ) {
    }

    public function match(string $text, ?DatasetBundleV3 $bundle = null): ConceptInterface
    {
        $index = $this->resolveIndex($bundle);
        if ($index === null) {
            return ConceptHandle::unknown($text);
        }
        if ($this->matchAlgorithm !== null) {
            return $this->matchAlgorithm->match($text, $this->buildCandidates($index));
        }
        $key = MakeKey::normalize($text);
        if ($key !== '' && $index->conditionName($key) !== null) {
            return ConceptHandle::knownCondition($index, $key, $text);
        }
        return ConceptHandle::unknown($text);
    }

    /**
     * Match each input independently and return the resulting handles
     * in input order. Unknown inputs surface as unknown concepts (never
     * dropped), so `count($result) === count($texts)` always holds.
     *
     * @param list<string> $texts
     * @return list<ConceptInterface>
     */
    public function matchMany(array $texts, ?DatasetBundleV3 $bundle = null): array
    {
        $out = [];
        foreach ($texts as $text) {
            $out[] = $this->match($text, $bundle);
        }
        return $out;
    }

    /**
     * Autocomplete free text against the condition catalog.
     *
     * Delegates to the injected {@see AutocompleteAlgorithmInterface}
     * (or {@see DefaultAutocompleteAlgorithm} when none was supplied).
     * Frequencies are seeded from the index's per-entity prescription
     * counts unless the caller overrides via `$options->frequencies`.
     *
     * @return list<Suggestion>
     */
    public function autocomplete(
        string $text,
        ?AutocompleteOptions $options = null,
        ?DatasetBundleV3 $bundle = null,
    ): array {
        $index = $this->resolveIndex($bundle);
        if ($index === null) {
            return [];
        }
        $opts = $options ?? new AutocompleteOptions();
        if ($opts->frequencies === []) {
            $freqs = [];
            foreach ($index->allConditionIds() as $id) {
                $freqs[$id] = $index->entityFrequency($id);
            }
            $opts = new AutocompleteOptions(
                limit: $opts->limit,
                kinds: $opts->kinds,
                frequencies: $freqs,
                sort: $opts->sort,
            );
        }
        $algo = $this->autocompleteAlgorithm ?? new DefaultAutocompleteAlgorithm();
        return $algo->rank($text, $this->buildCandidates($index), $opts);
    }

    /**
     * Every known condition in `$bundle` (or the cached bundle when
     * called bundleless), ordered by ascending display name. Returns
     * `[]` if no bundle is available.
     *
     * @return list<ConditionConceptInterface>
     */
    public function list(?DatasetBundleV3 $bundle = null): array
    {
        $index = $this->resolveIndex($bundle);
        if ($index === null) {
            return [];
        }
        $ids = $index->allConditionIds();
        usort(
            $ids,
            static fn (string $a, string $b): int =>
                strcmp($index->conditionName($a) ?? $a, $index->conditionName($b) ?? $b),
        );
        $out = [];
        foreach ($ids as $id) {
            $out[] = ConceptHandle::knownCondition($index, $id, $id);
        }
        return $out;
    }

    /** @return list<ConceptInterface> */
    private function buildCandidates(ReferenceIndex $index): array
    {
        $out = [];
        foreach ($index->allConditionIds() as $id) {
            $out[] = ConceptHandle::knownCondition($index, $id, $id);
        }
        return $out;
    }

    private function resolveIndex(?DatasetBundleV3 $bundle): ?ReferenceIndex
    {
        if ($bundle !== null) {
            return ReferenceIndex::forBundle($bundle);
        }
        return $this->cache?->currentIndex();
    }
}
