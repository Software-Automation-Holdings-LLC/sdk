<?php

declare(strict_types=1);

namespace Isa\Sdk\Tests\Zyins\Reference;

use Isa\Sdk\Zyins\Reference\ConceptInterface;
use Isa\Sdk\Zyins\Reference\ConceptKind;
use Isa\Sdk\Zyins\Reference\ConditionConceptInterface;
use Isa\Sdk\Zyins\Reference\ConditionRow;
use Isa\Sdk\Zyins\Reference\DatasetBundleV3;
use Isa\Sdk\Zyins\Reference\DatasetEntry;
use Isa\Sdk\Zyins\Reference\MedicationConceptInterface;
use Isa\Sdk\Zyins\Reference\MedicationRow;
use Isa\Sdk\Zyins\Reference\Reference;
use Isa\Sdk\Zyins\Reference\ReferenceIndex;
use Isa\Sdk\Zyins\Reference\Relation;
use Isa\Sdk\Zyins\Reference\Sort;
use PHPUnit\Framework\TestCase;

/**
 * Behavioral tests for the locked PHP Reference surface: unknown
 * concepts never throw, marker interfaces narrow by type, frequency
 * order matches the v3 use_map, equality folds case differences via
 * `MakeKey`, and {@see ReferenceIndex} invalidates per dataset version.
 *
 * The shared conformance vectors are covered in {@see ConformanceTest};
 * this file covers the PHP-idiomatic surface (Sort/ConceptKind class
 * constants, ConceptInterface marker subtypes, Tier 3 sugar).
 */
final class ReferenceMatchTest extends TestCase
{
    public function testMatchUnknownTextReturnsUnknownConceptWithoutThrowing(): void
    {
        $reference = new Reference();
        $bundle = self::tinyBundle();
        $concept = $reference->concepts->match('totally made up text', $bundle);

        self::assertFalse($concept->isKnown());
        self::assertNull($concept->id());
        self::assertSame(ConceptKind::UNKNOWN, $concept->kind());
        self::assertSame('totally made up text', $concept->inputText());
        self::assertSame([], $concept->medications());
        self::assertSame([], $concept->conditions());
    }

    public function testEmptyInputReturnsUnknownConcept(): void
    {
        $reference = new Reference();
        $bundle = self::tinyBundle();
        $concept = $reference->medications->match('', $bundle);

        self::assertFalse($concept->isKnown());
        self::assertSame('', $concept->inputText());
    }

    public function testMedicationMatchExposesMarkerInterface(): void
    {
        $reference = new Reference();
        $bundle = self::tinyBundle();
        $concept = $reference->medications->match('lisinopril', $bundle);

        self::assertInstanceOf(MedicationConceptInterface::class, $concept);
        self::assertNotInstanceOf(ConditionConceptInterface::class, $concept);
        self::assertSame(ConceptKind::MEDICATION, $concept->kind());
    }

    public function testConditionMatchExposesMarkerInterface(): void
    {
        $reference = new Reference();
        $bundle = self::tinyBundle();
        $concept = $reference->conditions->match('hbp', $bundle);

        self::assertInstanceOf(ConditionConceptInterface::class, $concept);
        self::assertNotInstanceOf(MedicationConceptInterface::class, $concept);
        self::assertSame(ConceptKind::CONDITION, $concept->kind());
    }

    public function testMedicationsTraversalIsFrequencySortedByDefault(): void
    {
        $reference = new Reference();
        $bundle = self::tinyBundle();
        $hbp = $reference->conditions->match('hbp', $bundle);

        $defaultOrder = array_map(static fn (ConceptInterface $c): ?string => $c->id(), $hbp->medications());
        $explicit = array_map(
            static fn (ConceptInterface $c): ?string => $c->id(),
            $hbp->medications(Sort::MOST_COMMON_FIRST),
        );

        self::assertSame($defaultOrder, $explicit);
        self::assertSame(['LISINOPRIL', 'LOSARTAN'], $defaultOrder, 'use_map says LISINOPRIL is more common than LOSARTAN');
    }

    public function testAlphabeticalSortOrdersByDisplayName(): void
    {
        $reference = new Reference();
        $bundle = self::tinyBundle();
        $hbp = $reference->conditions->match('hbp', $bundle);

        $alpha = array_map(
            static fn (ConceptInterface $c): ?string => $c->id(),
            $hbp->medications(Sort::ALPHABETICAL),
        );

        self::assertSame(['LISINOPRIL', 'LOSARTAN'], $alpha);
    }

    public function testEqualsFoldsCaseDifferencesOnUnknownInputs(): void
    {
        $reference = new Reference();
        $bundle = self::tinyBundle();
        $a = $reference->concepts->match('Totally Unknown', $bundle);
        $b = $reference->concepts->match('TOTALLY-unknown', $bundle);

        self::assertFalse($a->isKnown());
        self::assertFalse($b->isKnown());
        self::assertTrue($a->equals($b), 'unknown concepts equal when MakeKey-normalized input matches');
    }

    public function testEqualsFoldsCaseDifferencesOnKnownConcepts(): void
    {
        $reference = new Reference();
        $bundle = self::tinyBundle();
        $a = $reference->medications->match('Lisinopril', $bundle);
        $b = $reference->medications->match('LISINOPRIL', $bundle);

        self::assertTrue($a->isKnown());
        self::assertTrue($b->isKnown());
        self::assertTrue($a->equals($b));
    }

    public function testEqualsRejectsDifferentKindsEvenWhenIdMatches(): void
    {
        $reference = new Reference();
        $bundle = self::tinyBundle();
        $hbp = $reference->conditions->match('hbp', $bundle);
        $lis = $reference->medications->match('lisinopril', $bundle);

        self::assertFalse($hbp->equals($lis));
    }

    public function testMatchManyPreservesOrderAndIncludesUnknowns(): void
    {
        $reference = new Reference();
        $bundle = self::tinyBundle();
        $concepts = $reference->concepts->matchMany(['hbp', 'nope', 'lisinopril'], $bundle);

        self::assertCount(3, $concepts);
        self::assertSame('HBP', $concepts[0]->id());
        self::assertFalse($concepts[1]->isKnown());
        self::assertSame('nope', $concepts[1]->inputText());
        self::assertSame('LISINOPRIL', $concepts[2]->id());
    }

    public function testListReturnsEveryKnownMedicationSortedByName(): void
    {
        $reference = new Reference();
        $bundle = self::tinyBundle();
        $all = $reference->medications->list($bundle);

        $ids = array_map(static fn (MedicationConceptInterface $c): ?string => $c->id(), $all);
        self::assertSame(['LISINOPRIL', 'LOSARTAN'], $ids);
    }

    public function testListReturnsEveryKnownConditionSortedByName(): void
    {
        $reference = new Reference();
        $bundle = self::tinyBundle();
        $all = $reference->conditions->list($bundle);

        $ids = array_map(static fn (ConditionConceptInterface $c): ?string => $c->id(), $all);
        self::assertSame(['DIABETES', 'HBP'], $ids);
    }

    public function testReferenceIndexCachesAcrossMatchesOnSameBundle(): void
    {
        $bundle = self::tinyBundle();
        $first = ReferenceIndex::forBundle($bundle);
        $second = ReferenceIndex::forBundle($bundle);

        self::assertSame($first, $second, 'same bundle yields cached index');
    }

    public function testReferenceIndexInvalidatesPerDatasetVersion(): void
    {
        $bundleA = self::tinyBundle();
        $bundleB = self::tinyBundle(version: '2026-06-01');

        $indexA = ReferenceIndex::forBundle($bundleA);
        $indexB = ReferenceIndex::forBundle($bundleB);

        self::assertNotSame($indexA, $indexB, 'distinct bundle instances yield distinct indexes');
        self::assertSame('2026-05-14', $indexA->datasetVersion());
        self::assertSame('2026-06-01', $indexB->datasetVersion());
    }

    public function testSortAndConceptKindAreNotInstantiable(): void
    {
        $sortCtor = (new \ReflectionClass(Sort::class))->getConstructor();
        self::assertNotNull($sortCtor);
        self::assertTrue($sortCtor->isPrivate(), 'Sort must not be instantiable');

        $kindCtor = (new \ReflectionClass(ConceptKind::class))->getConstructor();
        self::assertNotNull($kindCtor);
        self::assertTrue($kindCtor->isPrivate(), 'ConceptKind must not be instantiable');
    }

    public function testSortConstantsMirrorWireValues(): void
    {
        self::assertSame('most_common_first', Sort::MOST_COMMON_FIRST);
        self::assertSame('alphabetical', Sort::ALPHABETICAL);
        self::assertSame('medication', ConceptKind::MEDICATION);
        self::assertSame('condition', ConceptKind::CONDITION);
        self::assertSame('unknown', ConceptKind::UNKNOWN);
    }

    public function testConditionsTraversalFromMedicationExposesConditionMarkers(): void
    {
        $reference = new Reference();
        $bundle = self::tinyBundle();
        $lisinopril = $reference->medications->match('lisinopril', $bundle);

        $conditions = $lisinopril->conditions();
        self::assertNotEmpty($conditions);
        foreach ($conditions as $cond) {
            self::assertInstanceOf(ConditionConceptInterface::class, $cond);
            self::assertSame(ConceptKind::CONDITION, $cond->kind());
        }
    }

    private static function tinyBundle(string $version = '2026-05-14'): DatasetBundleV3
    {
        $conditions = [
            new ConditionRow(
                id: 'HBP',
                name: 'High blood pressure',
                treatedWith: [
                    new Relation(id: 'LISINOPRIL', name: 'Lisinopril', prescriptionCount: 100),
                    new Relation(id: 'LOSARTAN', name: 'Losartan', prescriptionCount: 25),
                ],
            ),
            new ConditionRow(id: 'DIABETES', name: 'Diabetes', treatedWith: []),
        ];
        $medications = [
            new MedicationRow(
                id: 'LISINOPRIL',
                name: 'Lisinopril',
                usedFor: [new Relation(id: 'HBP', name: 'High blood pressure', prescriptionCount: 100)],
            ),
            new MedicationRow(
                id: 'LOSARTAN',
                name: 'Losartan',
                usedFor: [new Relation(id: 'HBP', name: 'High blood pressure', prescriptionCount: 25)],
            ),
        ];
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
}
