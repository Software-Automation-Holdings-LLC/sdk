<?php

declare(strict_types=1);

namespace Isa\Sdk\Tests\Zyins\Reference;

use Isa\Sdk\Zyins\Reference\AutocompleteOptions;
use Isa\Sdk\Zyins\Reference\ConceptInterface;
use Isa\Sdk\Zyins\Reference\ConceptKind;
use Isa\Sdk\Zyins\Reference\DefaultAutocompleteAlgorithm;
use Isa\Sdk\Zyins\Reference\Sort;
use PHPUnit\Framework\TestCase;

/**
 * Spec for the query-length-unbounded fuzzy fallback.
 *
 * rank() tokenizes caller-supplied typeahead text with no length cap.
 * When the literal prefilter misses, the default fuzzy fallback compares
 * every query word with every token of every candidate and recomputes
 * Double Metaphone on the candidate token for each pair. limit only
 * trims the list returned after that scan.
 */
final class AutocompleteQueryBoundTest extends TestCase
{
    private const CATALOG_SIZE = 400;

    private const BASELINE_WORDS = 4;

    private const ATTACK_WORDS = 600;

    private const SCALE = 5;

    private const FLOOR_SECONDS = 0.05;

    public function testRankLongUnmatchedQueryStaysWithinBaseline(): void
    {
        $algo = new DefaultAutocompleteAlgorithm();
        $candidates = self::catalog(self::CATALOG_SIZE);
        $options = new AutocompleteOptions(limit: 1);

        [$baseline, $baselineCount] = self::elapsed($algo, self::query(self::BASELINE_WORDS), $candidates, $options);
        [$attack, $attackCount] = self::elapsed($algo, self::query(self::ATTACK_WORDS), $candidates, $options);

        self::assertSame(0, $baselineCount);
        self::assertSame(0, $attackCount);
        self::assertBounded($baseline, $attack);
    }

    public function testRankAlphabeticalLongUnmatchedQueryStaysWithinBaseline(): void
    {
        $algo = new DefaultAutocompleteAlgorithm();
        $candidates = self::catalog(self::CATALOG_SIZE);
        $options = new AutocompleteOptions(limit: 1, sort: Sort::ALPHABETICAL);

        [$baseline] = self::elapsed($algo, self::query(self::BASELINE_WORDS), $candidates, $options);
        [$attack, $attackCount] = self::elapsed($algo, self::query(self::ATTACK_WORDS), $candidates, $options);

        self::assertSame(0, $attackCount);
        self::assertBounded($baseline, $attack);
    }

    private static function assertBounded(float $baseline, float $observed): void
    {
        $limit = max(self::FLOOR_SECONDS, $baseline * self::SCALE);
        self::assertLessThanOrEqual(
            $limit,
            $observed,
            sprintf('autocomplete rank took %.3fs; limit %.3fs (baseline %.3fs)', $observed, $limit, $baseline),
        );
    }

    /**
     * @param list<ConceptInterface> $candidates
     * @return array{0:float,1:int}
     */
    private static function elapsed(
        DefaultAutocompleteAlgorithm $algo,
        string $query,
        array $candidates,
        AutocompleteOptions $options,
    ): array {
        $started = hrtime(true);
        $suggestions = $algo->rank($query, $candidates, $options);
        $seconds = (hrtime(true) - $started) / 1_000_000_000;

        return [$seconds, count($suggestions)];
    }

    /** @return list<ConceptInterface> */
    private static function catalog(int $n): array
    {
        $out = [];
        for ($i = 0; $i < $n; $i++) {
            $out[] = self::condition(sprintf('C%d', $i), sprintf('Condition Alpha %d', $i));
        }

        return $out;
    }

    private static function query(int $words): string
    {
        return implode(' ', array_fill(0, $words, 'qx'));
    }

    private static function condition(string $id, string $name): ConceptInterface
    {
        return new class ($id, $name) implements ConceptInterface {
            public function __construct(
                private readonly string $conceptId,
                private readonly string $conceptName,
            ) {
            }

            public function id(): ?string
            {
                return $this->conceptId;
            }

            public function name(): string
            {
                return $this->conceptName;
            }

            public function kind(): string
            {
                return ConceptKind::CONDITION;
            }

            public function isKnown(): bool
            {
                return true;
            }

            public function inputText(): string
            {
                return $this->conceptName;
            }

            public function conditions(string $sort = Sort::MOST_COMMON_FIRST): array
            {
                return [];
            }

            public function medications(string $sort = Sort::MOST_COMMON_FIRST): array
            {
                return [];
            }

            public function equals(ConceptInterface $other): bool
            {
                return $this->conceptId === $other->id();
            }
        };
    }
}
