<?php

declare(strict_types=1);

namespace Isa\Sdk\Tests\Zyins\Reference;

use Isa\Sdk\Zyins\Reference\ConceptInterface;
use Isa\Sdk\Zyins\Reference\ConditionRow;
use Isa\Sdk\Zyins\Reference\ConditionsMatcher;
use Isa\Sdk\Zyins\Reference\DatasetBundleV3;
use Isa\Sdk\Zyins\Reference\DatasetEntry;
use Isa\Sdk\Zyins\Reference\DefaultMatchAlgorithm;
use Isa\Sdk\Zyins\Reference\MedicationRow;
use Isa\Sdk\Zyins\Reference\MedicationsMatcher;
use Isa\Sdk\Zyins\Reference\Reference;
use Isa\Sdk\Zyins\Reference\ReferenceIndex;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * A letter string that is not a catalog id falls through to the sorted
 * check-key. That normalizer allocates one array slot per character.
 * These tests bound the extra peak memory of every public entry that
 * feeds caller text into that path.
 *
 * 80_000 letters is enough for that array to add several megabytes
 * (~70 bytes per letter) and small enough that the vulnerable run
 * still fits in a 128M limit, so the assertion fails instead of
 * aborting the process. A cap of a couple hundred characters, applied
 * before the array is built, stays under half a megabyte. Rejecting
 * the string before that allocation is the other acceptable outcome.
 */
final class CheckKeyAllocationTest extends TestCase
{
    /** Letters, so the exact-key normalizer does not return empty and skip the check-key. */
    private const ATTACK_LETTERS = 80_000;

    /** Above a truncated or rejected call, below one slot per letter. */
    private const MAX_ADDED_PEAK_BYTES = 512 * 1024;

    #[DataProvider('callerTextEntries')]
    public function testLongUncataloguedLettersStayWithinMemoryBudget(string $entry): void
    {
        $text = str_repeat('a', self::ATTACK_LETTERS);
        $bundle = self::bundle();

        gc_collect_cycles();
        memory_reset_peak_usage();
        $start = memory_get_usage();
        try {
            $result = self::runEntry($entry, $text, $bundle);
        } catch (\Throwable) {
            $result = null;
        }
        $added = memory_get_peak_usage() - $start;

        self::assertLessThan(
            self::MAX_ADDED_PEAK_BYTES,
            $added,
            sprintf(
                '%s added %d bytes of peak memory for a %d-letter uncatalogued string',
                $entry,
                $added,
                self::ATTACK_LETTERS,
            ),
        );
        foreach (is_array($result) ? $result : [$result] as $item) {
            if ($item instanceof ConceptInterface) {
                self::assertFalse($item->isKnown());
            }
            self::assertIsNotString($item);
        }
    }

    public function testReorderedConditionNameStillResolves(): void
    {
        $concept = (new Reference())->conditions->match('pressure blood high', self::bundle());

        self::assertTrue($concept->isKnown());
        self::assertSame('HBP', $concept->id());
    }

    public function testReorderedMedicationNameStillResolves(): void
    {
        $concept = (new Reference())->medications->match('pril lisino', self::bundle());

        self::assertTrue($concept->isKnown());
        self::assertSame('LISINOPRIL', $concept->id());
    }

    public function testReorderedConceptQueryStillResolvesCondition(): void
    {
        $concept = (new Reference())->concepts->match('pressure blood high', self::bundle());

        self::assertTrue($concept->isKnown());
        self::assertSame('HBP', $concept->id());
    }

    /** @return iterable<string, array{string}> */
    public static function callerTextEntries(): iterable
    {
        yield 'conditions.match' => ['conditions.match'];
        yield 'conditions.matchMany' => ['conditions.matchMany'];
        yield 'medications.match' => ['medications.match'];
        yield 'medications.matchMany' => ['medications.matchMany'];
        yield 'concepts.match' => ['concepts.match'];
        yield 'concepts.matchMany' => ['concepts.matchMany'];
        yield 'conditions.match-default-algorithm' => ['conditions.match-default-algorithm'];
        yield 'medications.match-default-algorithm' => ['medications.match-default-algorithm'];
        yield 'default-algorithm.match' => ['default-algorithm.match'];
        yield 'reference-index.resolve-condition' => ['reference-index.resolve-condition'];
        yield 'reference-index.resolve-medication' => ['reference-index.resolve-medication'];
    }

    private static function runEntry(string $entry, string $text, DatasetBundleV3 $bundle): mixed
    {
        $reference = new Reference();
        $algorithm = new DefaultMatchAlgorithm();

        return match ($entry) {
            'conditions.match' => $reference->conditions->match($text, $bundle),
            'conditions.matchMany' => $reference->conditions->matchMany([$text], $bundle),
            'medications.match' => $reference->medications->match($text, $bundle),
            'medications.matchMany' => $reference->medications->matchMany([$text], $bundle),
            'concepts.match' => $reference->concepts->match($text, $bundle),
            'concepts.matchMany' => $reference->concepts->matchMany([$text], $bundle),
            'conditions.match-default-algorithm' => (new ConditionsMatcher(matchAlgorithm: $algorithm))
                ->match($text, $bundle),
            'medications.match-default-algorithm' => (new MedicationsMatcher(matchAlgorithm: $algorithm))
                ->match($text, $bundle),
            'default-algorithm.match' => $algorithm->match($text, $reference->conditions->list($bundle)),
            'reference-index.resolve-condition' => ReferenceIndex::forBundle($bundle)->resolveCondition($text),
            'reference-index.resolve-medication' => ReferenceIndex::forBundle($bundle)->resolveMedication($text),
            default => throw new \InvalidArgumentException('unknown entry '.$entry),
        };
    }

    private static function bundle(): DatasetBundleV3
    {
        $conditions = [
            new ConditionRow(id: 'HBP', name: 'High blood pressure', treatedWith: []),
        ];
        $medications = [
            new MedicationRow(id: 'LISINOPRIL', name: 'Lisinopril', usedFor: []),
        ];

        return new DatasetBundleV3(
            version: 'check-key-allocation',
            medications: $medications,
            conditions: $conditions,
            products: [],
            nicotineOptions: [],
            spellingCorrections: [],
            datasets: [
                'conditions' => new DatasetEntry(version: 'check-key-allocation', itemCount: 1, items: $conditions),
                'medications' => new DatasetEntry(version: 'check-key-allocation', itemCount: 1, items: $medications),
            ],
        );
    }
}
