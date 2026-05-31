<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Reference;

/**
 * Tuning options for {@see AutocompleteAlgorithmInterface::rank()}.
 *
 * `kinds` filters which concept kinds are eligible (e.g. medications
 * only, conditions only, or both). `frequencies` is an opaque id →
 * prescription count map; missing ids score as zero. `limit` clips the
 * returned suggestion list.
 */
final readonly class AutocompleteOptions
{
    /**
     * @param int                  $limit       Max suggestions to return; <=0 means "no cap".
     * @param list<string>         $kinds       Allowed {@see ConceptKind} discriminators; empty means all.
     * @param array<string,int>    $frequencies Id → prescription count; missing ids score as 0.
     * @param string               $sort        Result ordering ({@see Sort}). MOST_COMMON_FIRST (default)
     *                                          keeps the bucketed relevance + frequency-boost order;
     *                                          ALPHABETICAL keeps the same relevance FILTER but emits
     *                                          matches in a flat case-insensitive A→Z order by name.
     */
    public function __construct(
        public int $limit = 10,
        public array $kinds = [],
        public array $frequencies = [],
        public string $sort = Sort::MOST_COMMON_FIRST,
    ) {
    }
}
