<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Reference;

/**
 * Ranked autocomplete suggestion.
 *
 * A {@see Suggestion} is a {@see ConceptInterface} handle (medication or
 * condition concept) plus the bucket label and within-bucket score the
 * {@see AutocompleteAlgorithmInterface} assigned. Consumers render
 * `name()` for the option list; advanced renderers may surface the
 * bucket to explain "why this match" or sort by score.
 *
 * Returned by {@see AutocompleteAlgorithmInterface::rank()} and by the
 * domain-bound facades on the {@see \Isa\Sdk\Zyins\ZyInsClient} —
 * `$isa->zyins->conditions->autocomplete($text, $opts)` and
 * `$isa->zyins->medications->autocomplete($text, $opts)`.
 *
 * @example
 *  $hits = $isa->zyins->conditions->autocomplete('hbp', new AutocompleteOptions(limit: 5));
 *  foreach ($hits as $hit) {
 *      printf("%-30s [%s @ %d]\n", $hit->name(), $hit->bucket, $hit->score);
 *  }
 */
final readonly class Suggestion implements ConceptInterface
{
    /**
     * @param string $bucket Which ranking bucket the candidate landed in;
     *     one of the {@see SuggestionBucket} string constants in the
     *     default algorithm. Custom adapters may emit any string.
     * @param int    $score  Frequency-weighted score; higher ranks first within bucket.
     */
    public function __construct(
        public ConceptInterface $concept,
        public string $bucket,
        public int $score,
    ) {
    }

    public function id(): ?string
    {
        return $this->concept->id();
    }

    public function name(): string
    {
        return $this->concept->name();
    }

    public function kind(): string
    {
        return $this->concept->kind();
    }

    public function isKnown(): bool
    {
        return $this->concept->isKnown();
    }

    public function inputText(): string
    {
        return $this->concept->inputText();
    }

    public function conditions(string $sort = Sort::MOST_COMMON_FIRST): array
    {
        return $this->concept->conditions($sort);
    }

    public function medications(string $sort = Sort::MOST_COMMON_FIRST): array
    {
        return $this->concept->medications($sort);
    }

    public function equals(ConceptInterface $other): bool
    {
        return $this->concept->equals($other instanceof self ? $other->concept : $other);
    }
}
