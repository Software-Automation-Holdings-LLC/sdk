<?php

declare(strict_types=1);

namespace Isa\Sdk\Tests\Zyins\Reference;

use Isa\Sdk\Zyins\Reference\ConceptKind;
use Isa\Sdk\Zyins\Reference\ConceptsMatcher;
use Isa\Sdk\Zyins\Reference\ConditionRow;
use Isa\Sdk\Zyins\Reference\ConditionsMatcher;
use Isa\Sdk\Zyins\Reference\DatasetBundleV3;
use Isa\Sdk\Zyins\Reference\DatasetEntry;
use Isa\Sdk\Zyins\Reference\MakeKey;
use Isa\Sdk\Zyins\Reference\MedicationRow;
use Isa\Sdk\Zyins\Reference\MedicationsMatcher;
use Isa\Sdk\Zyins\Reference\Reference;
use Isa\Sdk\Zyins\Reference\Relation;
use Isa\Sdk\Zyins\Reference\Sort;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;

/**
 * Cross-language conformance test for the v3 `reference` namespace.
 *
 * Loads `shared/schemas/sdk/testdata/reference_vectors.json` — the same
 * ground-truth fixture the TS / Go / Python / C# SDKs assert against —
 * and verifies every `make_key` parity vector and every `match()`
 * scenario passes byte-identical in PHP. Drift between languages must
 * surface here.
 */
#[CoversClass(MakeKey::class)]
#[CoversClass(Reference::class)]
#[CoversClass(MedicationsMatcher::class)]
#[CoversClass(ConditionsMatcher::class)]
#[CoversClass(ConceptsMatcher::class)]
final class ConformanceTest extends TestCase
{
    /** @return iterable<string,array{string,string}> */
    public static function makeKeyVectorProvider(): iterable
    {
        $vectors = self::loadVectors();
        $makeKey = $vectors['make_key'];
        \PHPUnit\Framework\Assert::assertIsArray($makeKey);
        foreach ($makeKey as $i => $vec) {
            \PHPUnit\Framework\Assert::assertIsArray($vec);
            $input = $vec['input'];
            $expected = $vec['expected'];
            \PHPUnit\Framework\Assert::assertIsString($input);
            \PHPUnit\Framework\Assert::assertIsString($expected);
            $label = sprintf('#%d %s → %s', $i, json_encode($input), json_encode($expected));
            yield $label => [$input, $expected];
        }
    }

    #[\PHPUnit\Framework\Attributes\DataProvider('makeKeyVectorProvider')]
    public function testMakeKeyParityVector(string $input, string $expected): void
    {
        self::assertSame($expected, MakeKey::normalize($input));
    }

    /** @return iterable<string,array{0:array<string,mixed>}> */
    public static function matchScenarioProvider(): iterable
    {
        $vectors = self::loadVectors();
        $matches = $vectors['matches'];
        \PHPUnit\Framework\Assert::assertIsArray($matches);
        foreach ($matches as $scenario) {
            \PHPUnit\Framework\Assert::assertIsArray($scenario);
            $name = $scenario['name'] ?? null;
            \PHPUnit\Framework\Assert::assertIsString($name);
            /** @var array<string,mixed> $scenario */
            yield $name => [$scenario];
        }
    }

    /**
     * @param array<string,mixed> $scenario
     */
    #[\PHPUnit\Framework\Attributes\DataProvider('matchScenarioProvider')]
    public function testMatchScenario(array $scenario): void
    {
        $bundleFixture = self::loadVectors()['bundle'];
        self::assertIsArray($bundleFixture);
        /** @var array<string,mixed> $bundleFixture */
        $bundle = self::bundleFromFixture($bundleFixture);
        $reference = new Reference();
        $matcherName = $scenario['matcher'];
        $matcher = match ($matcherName) {
            'medications' => $reference->medications(),
            'conditions' => $reference->conditions(),
            'concepts' => $reference->concepts(),
            default => self::fail('unknown matcher ' . (is_string($matcherName) ? $matcherName : '')),
        };

        $input = $scenario['input'];
        self::assertIsString($input);
        $concept = $matcher->match($input, $bundle);

        self::assertSame($scenario['expected_kind'], $concept->kind(), 'expected_kind');
        self::assertSame($scenario['expected_known'], $concept->isKnown(), 'expected_known');
        self::assertSame($scenario['expected_id'], $concept->id(), 'expected_id');
        self::assertSame($input, $concept->inputText(), 'inputText preserved');

        if (array_key_exists('input_text_preserved', $scenario)) {
            self::assertSame($scenario['input_text_preserved'], $concept->inputText());
        }

        if (array_key_exists('medications_most_common_first', $scenario)) {
            $ids = array_map(static fn ($c) => $c->id() ?? '', $concept->medications(Sort::MOST_COMMON_FIRST));
            self::assertSame($scenario['medications_most_common_first'], $ids);
        }
        if (array_key_exists('medications_alphabetical', $scenario)) {
            $ids = array_map(static fn ($c) => $c->id() ?? '', $concept->medications(Sort::ALPHABETICAL));
            self::assertSame($scenario['medications_alphabetical'], $ids);
        }
        if (array_key_exists('conditions_most_common_first', $scenario)) {
            $ids = array_map(static fn ($c) => $c->id() ?? '', $concept->conditions(Sort::MOST_COMMON_FIRST));
            self::assertSame($scenario['conditions_most_common_first'], $ids);
        }
        if (($scenario['conditions_any_known'] ?? false) === true) {
            $conds = $concept->conditions(Sort::MOST_COMMON_FIRST);
            self::assertNotEmpty($conds);
            foreach ($conds as $c) {
                self::assertTrue($c->isKnown());
            }
        }
    }

    public function testUnknownConceptReturnsEmptyAccessorsAndPreservesInput(): void
    {
        $bundleFixture = self::loadVectors()['bundle'];
        self::assertIsArray($bundleFixture);
        /** @var array<string,mixed> $bundleFixture */
        $bundle = self::bundleFromFixture($bundleFixture);
        $concept = (new ConceptsMatcher())->match('unknown free text', $bundle);
        self::assertFalse($concept->isKnown());
        self::assertNull($concept->id());
        self::assertSame('unknown free text', $concept->inputText());
        self::assertSame(ConceptKind::UNKNOWN, $concept->kind());
        self::assertSame([], $concept->medications());
        self::assertSame([], $concept->conditions());
    }

    public function testCanonicalLiveBugHbpMedicationsAreNonEmptyAndFrequencyOrdered(): void
    {
        $bundleFixture = self::loadVectors()['bundle'];
        self::assertIsArray($bundleFixture);
        /** @var array<string,mixed> $bundleFixture */
        $bundle = self::bundleFromFixture($bundleFixture);
        $concept = (new ConditionsMatcher())->match('hbp', $bundle);
        self::assertTrue($concept->isKnown());
        $meds = $concept->medications(Sort::MOST_COMMON_FIRST);
        self::assertNotEmpty($meds);
        self::assertSame('LISINOPRIL', $meds[0]->id());
        self::assertSame('LOSARTAN', $meds[count($meds) - 1]->id());
    }

    public function testRelatedConceptsPreserveOriginalInput(): void
    {
        $bundleFixture = self::loadVectors()['bundle'];
        self::assertIsArray($bundleFixture);
        /** @var array<string,mixed> $bundleFixture */
        $bundle = self::bundleFromFixture($bundleFixture);
        $condition = (new ConditionsMatcher())->match('hbp', $bundle);
        $meds = $condition->medications(Sort::MOST_COMMON_FIRST);
        self::assertSame('hbp', $meds[0]->inputText());

        $medication = (new MedicationsMatcher())->match('lisinopril', $bundle);
        $conds = $medication->conditions(Sort::MOST_COMMON_FIRST);
        self::assertSame('lisinopril', $conds[0]->inputText());
    }

    public function testMakeKeyIsNotExposedOnMatcherSurface(): void
    {
        // The reference matchers do not surface any `makekey` / `make_key`
        // method to consumers; normalization is an internal detail of
        // `match()`. `MakeKey` itself lives in the `Reference` namespace
        // per the locked design but is marked `@internal`.
        $publicMatchers = [MedicationsMatcher::class, ConditionsMatcher::class, ConceptsMatcher::class];
        foreach ($publicMatchers as $class) {
            $rc = new \ReflectionClass($class);
            foreach ($rc->getMethods(\ReflectionMethod::IS_PUBLIC) as $method) {
                $lowerName = strtolower($method->getName());
                self::assertStringNotContainsString('makekey', $lowerName);
                self::assertStringNotContainsString('make_key', $lowerName);
            }
        }
        $docComment = (new \ReflectionClass(MakeKey::class))->getDocComment();
        self::assertNotFalse($docComment, 'MakeKey must carry an @internal doc comment');
        self::assertStringContainsString('@internal', $docComment);
    }

    /** @return array<string,mixed> */
    private static function loadVectors(): array
    {
        $path = __DIR__ . '/../../../../../shared/schemas/sdk/testdata/reference_vectors.json';
        $resolved = realpath($path);
        if ($resolved === false) {
            self::fail('reference_vectors.json not found at ' . $path);
        }
        $raw = file_get_contents($resolved);
        self::assertNotFalse($raw, 'failed to read ' . $resolved);
        /** @var array<string,mixed> $decoded */
        $decoded = json_decode($raw, true, flags: JSON_THROW_ON_ERROR);
        return $decoded;
    }

    /**
     * @param array<string,mixed> $fixture
     */
    private static function bundleFromFixture(array $fixture): DatasetBundleV3
    {
        $version = $fixture['version'];
        self::assertIsString($version);
        $conditionsRaw = self::namesFromFixture($fixture['conditions'] ?? []);
        $medicationsRaw = self::namesFromFixture($fixture['medications'] ?? []);

        $medsByConditionRaw = $fixture['medications_by_condition'] ?? [];
        self::assertIsArray($medsByConditionRaw);
        /** @var array<string,list<string>> $medsByCondition */
        $medsByCondition = $medsByConditionRaw;

        $freqRaw = $fixture['frequency_graphs'] ?? [];
        self::assertIsArray($freqRaw);
        $useMapRaw = $freqRaw['use_map'] ?? [];
        self::assertIsArray($useMapRaw);
        /** @var array<string,array<string,int>> $useMap */
        $useMap = $useMapRaw;

        // Synthesize inline-row shape from the legacy fixture so the
        // conformance corpus keeps validating under the v3 SDK without a
        // fixture rebuild. Server emits inline rows directly in prod.
        $conditions = [];
        foreach ($conditionsRaw as $id => $name) {
            $treated = [];
            foreach ($medsByCondition[$id] ?? [] as $medId) {
                $treated[] = new Relation(
                    id: $medId,
                    name: $medicationsRaw[$medId] ?? $medId,
                    prescriptionCount: $useMap[$id][$medId] ?? 0,
                );
            }
            $conditions[] = new ConditionRow(id: $id, name: $name, treatedWith: $treated);
        }
        $medConds = [];
        foreach ($medsByCondition as $condId => $medIds) {
            foreach ($medIds as $medId) {
                $medConds[$medId][] = $condId;
            }
        }
        $medications = [];
        foreach ($medicationsRaw as $id => $name) {
            $usedFor = [];
            foreach ($medConds[$id] ?? [] as $condId) {
                $usedFor[] = new Relation(
                    id: $condId,
                    name: $conditionsRaw[$condId] ?? $condId,
                    prescriptionCount: $useMap[$condId][$id] ?? 0,
                );
            }
            $medications[] = new MedicationRow(id: $id, name: $name, usedFor: $usedFor);
        }

        $datasets = [
            'conditions' => new DatasetEntry(version: $version, itemCount: count($conditions), items: $conditions),
            'medications' => new DatasetEntry(version: $version, itemCount: count($medications), items: $medications),
        ];

        return new DatasetBundleV3(
            version: $version,
            medications: $medications,
            conditions: $conditions,
            products: [],
            nicotineOptions: [],
            spellingCorrections: [],
            datasets: $datasets,
        );
    }

    /**
     * @param mixed $raw
     * @return array<string,string> id → display name
     */
    private static function namesFromFixture(mixed $raw): array
    {
        self::assertIsArray($raw);
        $out = [];
        foreach ($raw as $row) {
            self::assertIsArray($row);
            $id = $row['id'] ?? null;
            $name = $row['name'] ?? null;
            self::assertIsString($id);
            self::assertIsString($name);
            $out[$id] = $name;
        }
        return $out;
    }
}
