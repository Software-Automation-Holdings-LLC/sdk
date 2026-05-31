<?php

declare(strict_types=1);

namespace Isa\Sdk\Tests\Zyins\Reference;

use Isa\Sdk\Tests\Zyins\Support\FixedKeySource;
use Isa\Sdk\Tests\Zyins\Support\MockHttpClient;
use Isa\Sdk\Zyins\Reference\ConceptKind;
use Isa\Sdk\Zyins\Reference\ConditionRow;
use Isa\Sdk\Zyins\Reference\DatasetBundleV3;
use Isa\Sdk\Zyins\Reference\DatasetEntry;
use Isa\Sdk\Zyins\Reference\MedicationConceptInterface;
use Isa\Sdk\Zyins\Reference\MedicationRow;
use Isa\Sdk\Zyins\Reference\Reference;
use Isa\Sdk\Zyins\Reference\ReferenceBundleCache;
use Isa\Sdk\Zyins\Reference\ReferenceIndex;
use Isa\Sdk\Zyins\Reference\Relation;
use Isa\Sdk\Zyins\ZyInsClient;
use PHPUnit\Framework\TestCase;

/**
 * Pins the locked top-level cache-backed `match()` form:
 *
 *     $isa->zyins->medications->match($text);          // no bundle arg
 *     $isa->zyins->conditions->match($text);           // no bundle arg
 *     $isa->zyins->reference->concepts->match($text);  // no bundle arg
 *
 * The matcher consults the {@see ReferenceBundleCache} the client
 * constructs once and shares with {@see \Isa\Sdk\Zyins\Reference\DatasetsV3}.
 * Before `datasetsV3->get()` runs the cache is empty and bundleless
 * `match()` returns an unknown handle — never throws.
 */
final class BundlelessMatchTest extends TestCase
{
    private const FIXTURE_TOKEN = 'isa_test_' . 'EXAMPLE000000000000000';
    private const FIXED_IDEM = '550e8400-e29b-41d4-a716-446655440000';

    public function testBundlelessMatchReturnsUnknownBeforeBundleIsWarmed(): void
    {
        $cache = new ReferenceBundleCache();
        $reference = new Reference($cache);

        $hit = $reference->medications->match('lisinopril');

        self::assertFalse($hit->isKnown());
        self::assertSame('lisinopril', $hit->inputText());
        self::assertSame(ConceptKind::UNKNOWN, $hit->kind());
        self::assertNull($hit->id());
    }

    public function testBundlelessMatchUsesCacheOnceWarmed(): void
    {
        $cache = new ReferenceBundleCache();
        $cache->setBundle(self::tinyBundle());
        $reference = new Reference($cache);

        $hit = $reference->medications->match('lisinopril');

        self::assertTrue($hit->isKnown());
        self::assertSame('LISINOPRIL', $hit->id());
        self::assertInstanceOf(MedicationConceptInterface::class, $hit);
    }

    public function testBundlelessAndExplicitFormsAgreeWhenBundleMatchesCache(): void
    {
        $bundle = self::tinyBundle();
        $cache = new ReferenceBundleCache();
        $cache->setBundle($bundle);
        $reference = new Reference($cache);

        $bundleless = $reference->conditions->match('hbp');
        $explicit = $reference->conditions->match('hbp', $bundle);

        self::assertSame($bundleless->id(), $explicit->id());
        self::assertSame($bundleless->kind(), $explicit->kind());
    }

    public function testBundlelessListReturnsEmptyBeforeBundleIsWarmed(): void
    {
        $reference = new Reference(new ReferenceBundleCache());

        self::assertSame([], $reference->medications->list());
        self::assertSame([], $reference->conditions->list());
    }

    public function testCacheReplacementWithNewVersionInvalidatesIndex(): void
    {
        $cache = new ReferenceBundleCache();
        $cache->setBundle(self::tinyBundle(version: '2026-05-14'));
        $first = $cache->currentIndex();
        self::assertNotNull($first);

        $cache->setBundle(self::tinyBundle(version: '2026-06-01'));
        $second = $cache->currentIndex();
        self::assertNotNull($second);

        self::assertNotSame($first, $second, 'a new version must invalidate the built index');
        self::assertSame('2026-06-01', $second->datasetVersion());
    }

    public function testCacheReplacementWithSameVersionKeepsIndexLive(): void
    {
        $cache = new ReferenceBundleCache();
        $cache->setBundle(self::tinyBundle(version: '2026-05-14'));
        $first = $cache->currentIndex();
        self::assertNotNull($first);

        // Distinct instance, same version — must not thrash the index.
        $cache->setBundle(self::tinyBundle(version: '2026-05-14'));
        $second = $cache->currentIndex();

        self::assertSame($first, $second, 'same-version replacement is a no-op for the index');
    }

    public function testDatasetsV3GetWarmsTheReferenceCacheOnTheClient(): void
    {
        $http = new MockHttpClient();
        $http->queue(200, self::v3EnvelopeJson(), ['ETag' => ['"v1"']]);
        $client = new ZyInsClient(
            token: self::FIXTURE_TOKEN,
            httpClient: $http,
            idempotency: new FixedKeySource(self::FIXED_IDEM),
        );

        // Before the fetch — bundleless match yields unknown.
        $beforeBundle = $client->medications->match('lisinopril');
        self::assertFalse($beforeBundle->isKnown());

        $client->datasetsV3->get();

        // After the fetch — the cache is warm and bundleless match
        // resolves against the freshly-fetched catalog.
        $afterBundle = $client->medications->match('lisinopril');
        self::assertTrue($afterBundle->isKnown());
        self::assertSame('LISINOPRIL', $afterBundle->id());

        $afterCondition = $client->conditions->match('hbp');
        self::assertTrue($afterCondition->isKnown());
        self::assertSame('HBP', $afterCondition->id());
    }

    public function testReferenceWithoutCacheStillSupportsExplicitBundleForm(): void
    {
        // No cache → bundleless match must yield unknown; explicit
        // bundle must still resolve.
        $reference = new Reference();
        $bundle = self::tinyBundle();

        $miss = $reference->medications->match('lisinopril');
        self::assertFalse($miss->isKnown());

        $hit = $reference->medications->match('lisinopril', $bundle);
        self::assertTrue($hit->isKnown());
        self::assertSame('LISINOPRIL', $hit->id());
    }

    public function testReferenceIndexForBundleStillCachesPerBundle(): void
    {
        // Sanity: confirm the underlying WeakMap cache is unaffected by
        // the new ReferenceBundleCache layer.
        $bundle = self::tinyBundle();
        self::assertSame(
            ReferenceIndex::forBundle($bundle),
            ReferenceIndex::forBundle($bundle),
        );
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

    private static function v3EnvelopeJson(): string
    {
        return json_encode([
            'data' => [
                'version' => '2026-05-14',
                'datasets' => [
                    'conditions' => [
                        'version' => '2026-05-14',
                        'item_count' => 2,
                        'items' => [
                            [
                                'id' => 'HBP',
                                'name' => 'High blood pressure',
                                'treated_with' => [
                                    ['id' => 'LISINOPRIL', 'name' => 'Lisinopril', 'prescription_count' => 100],
                                    ['id' => 'LOSARTAN', 'name' => 'Losartan', 'prescription_count' => 25],
                                ],
                            ],
                            ['id' => 'DIABETES', 'name' => 'Diabetes', 'treated_with' => []],
                        ],
                    ],
                    'medications' => [
                        'version' => '2026-05-14',
                        'item_count' => 2,
                        'items' => [
                            [
                                'id' => 'LISINOPRIL',
                                'name' => 'Lisinopril',
                                'used_for' => [
                                    ['id' => 'HBP', 'name' => 'High blood pressure', 'prescription_count' => 100],
                                ],
                            ],
                            [
                                'id' => 'LOSARTAN',
                                'name' => 'Losartan',
                                'used_for' => [
                                    ['id' => 'HBP', 'name' => 'High blood pressure', 'prescription_count' => 25],
                                ],
                            ],
                        ],
                    ],
                ],
                // No response-root maps in inline-row v3 shape — the
                // datasets above carry treated_with[] / used_for[] inline.
            ],
        ], JSON_THROW_ON_ERROR);
    }
}
