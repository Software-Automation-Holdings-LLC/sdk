<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Reference;

/**
 * Pluggable text → ranked {@see Suggestion}[] adapter.
 *
 * Replaces the default bucketed autocomplete algorithm used by
 * `$isa->zyins->conditions->autocomplete($text, $opts)` and friends.
 * Implement this to ship a custom ranker (vector search, ML-backed
 * scorer, learned-to-rank) without touching the rest of the SDK.
 *
 * Contracts:
 *  - Never throws on no match — returns `[]`.
 *  - Order is significant: earlier suggestions rank higher.
 *  - Honor `AutocompleteOptions::$limit` and `$kinds`.
 *
 * @example
 *  $isa = Isa::withKeycode(autocompleteAlgorithm: new MyVectorRanker());
 *  $hits = $isa->zyins->conditions->autocomplete('hbp', new AutocompleteOptions(limit: 5));
 */
interface AutocompleteAlgorithmInterface
{
    /**
     * @param list<ConceptInterface> $candidates
     * @return list<Suggestion>
     */
    public function rank(string $query, array $candidates, AutocompleteOptions $options): array;
}
