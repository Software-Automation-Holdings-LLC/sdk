<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Reference;

use Isa\Sdk\Zyins\Reference\Internal\ConceptHandle;

/**
 * `isa->zyins->reference->medications` — free text → medication concept.
 *
 * Two call shapes:
 *
 *   $isa->zyins->medications->match('lisinopril');          // bundleless
 *   $isa->zyins->medications->match('lisinopril', $bundle); // explicit
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
 *  $med = $isa->zyins->medications->match('lisinopril');
 *  $suggestions = $isa->zyins->medications->autocomplete('lis', new AutocompleteOptions(limit: 5));
 */
final class MedicationsMatcher implements Matcher
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
        if ($key !== '' && $index->medicationName($key) !== null) {
            return ConceptHandle::knownMedication($index, $key, $text);
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
     * Autocomplete free text against the medication catalog. See
     * {@see ConditionsMatcher::autocomplete()} for parameter semantics.
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
            foreach ($index->allMedicationIds() as $id) {
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
     * Every known medication in `$bundle` (or the cached bundle when
     * called bundleless), ordered by ascending display name. Returns
     * `[]` if no bundle is available.
     *
     * @return list<MedicationConceptInterface>
     */
    public function list(?DatasetBundleV3 $bundle = null): array
    {
        $index = $this->resolveIndex($bundle);
        if ($index === null) {
            return [];
        }
        $ids = $index->allMedicationIds();
        usort(
            $ids,
            static fn (string $a, string $b): int =>
                strcmp($index->medicationName($a) ?? $a, $index->medicationName($b) ?? $b),
        );
        $out = [];
        foreach ($ids as $id) {
            $out[] = ConceptHandle::knownMedication($index, $id, $id);
        }
        return $out;
    }

    /** @return list<ConceptInterface> */
    private function buildCandidates(ReferenceIndex $index): array
    {
        $out = [];
        foreach ($index->allMedicationIds() as $id) {
            $out[] = ConceptHandle::knownMedication($index, $id, $id);
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
