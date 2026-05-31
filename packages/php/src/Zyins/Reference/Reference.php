<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Reference;

/**
 * `isa->zyins->reference` — typed catalog access via `match()` returning
 * {@see ConceptInterface} handles. Mirrors `isa.zyins.reference` in the
 * TS SDK.
 */
final readonly class Reference implements ReferenceService
{
    public MedicationsMatcher $medications;
    public ConditionsMatcher $conditions;
    public ConceptsMatcher $concepts;

    public function __construct(
        ?ReferenceBundleCache $cache = null,
        ?MatchAlgorithmInterface $matchAlgorithm = null,
        ?AutocompleteAlgorithmInterface $autocompleteAlgorithm = null,
    ) {
        $this->medications = new MedicationsMatcher($cache, $matchAlgorithm, $autocompleteAlgorithm);
        $this->conditions = new ConditionsMatcher($cache, $matchAlgorithm, $autocompleteAlgorithm);
        $this->concepts = new ConceptsMatcher($cache);
    }

    public function medications(): MedicationsMatcher
    {
        return $this->medications;
    }

    public function conditions(): ConditionsMatcher
    {
        return $this->conditions;
    }

    public function concepts(): ConceptsMatcher
    {
        return $this->concepts;
    }
}
