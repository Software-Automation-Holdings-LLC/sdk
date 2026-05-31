<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Reference;

/**
 * Pluggable text → single {@see ConceptInterface} match adapter.
 *
 * Replaces the default `make_key` exact-lookup matcher used by
 * `$isa->zyins->reference->medications->match($text)` and friends.
 * Implement this to plug a fuzzy / language-model / domain-tuned
 * matcher without touching the rest of the SDK.
 *
 * Contracts:
 *  - On no match, return an unknown {@see ConceptInterface}; never throw.
 *  - `query` is the verbatim consumer input — implementations are
 *    responsible for normalization.
 *
 * @example
 *  $isa = Isa::withKeycode(matchAlgorithm: new MyFuzzyMatchAlgorithm());
 *  $hbp = $isa->zyins->conditions->match('hi blood pressr');
 */
interface MatchAlgorithmInterface
{
    /**
     * @param list<ConceptInterface> $candidates Pre-fetched candidate
     *     concepts (typically every concept in the relevant catalog).
     */
    public function match(string $query, array $candidates): ConceptInterface;
}
