<?php

declare(strict_types=1);

namespace Isa\Sdk\Tests\Zyins\Reference;

use Isa\Sdk\Tests\Zyins\Support\MockHttpClient;
use Isa\Sdk\Zyins\Reference\DatasetBundleV3;
use Isa\Sdk\Zyins\Reference\DatasetCategory;
use Isa\Sdk\Zyins\Reference\DatasetsV3;
use Isa\Sdk\Zyins\Reference\DatasetsV3GetOptions;
use Isa\Sdk\Zyins\Reference\DatasetsV3NotModified;
use Isa\Sdk\Zyins\ZyInsClient;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;

/**
 * Transport-level coverage for `GET /v3/datasets`. The conformance
 * suite covers parse-into-handle semantics; this file pins down the
 * wire protocol: query strings, conditional-revalidation headers,
 * 304 handling, and envelope unwrap.
 */
#[CoversClass(DatasetsV3::class)]
#[CoversClass(DatasetsV3GetOptions::class)]
#[CoversClass(DatasetsV3NotModified::class)]
final class DatasetsV3Test extends TestCase
{
    private const TOKEN = 'isa_test_' . 'EXAMPLE000000000000000';

    public function testGetParsesEnvelopeIntoTypedBundle(): void
    {
        $http = new MockHttpClient();
        $http->queue(200, json_encode([
            'object' => 'reference_catalog',
            'request_id' => 'req_z',
            'data' => [
                'catalog_version' => '3.0',
                'datasets' => [
                    'medications' => [
                        'version' => '3.0',
                        'item_count' => 1,
                        'items' => [[
                            'id' => 'LISINOPRIL',
                            'name' => 'Lisinopril',
                            'used_for' => [
                                ['id' => 'HBP', 'name' => 'HBP', 'prescription_count' => 4120],
                            ],
                        ]],
                    ],
                    'conditions' => [
                        'version' => '3.0',
                        'item_count' => 1,
                        'items' => [[
                            'id' => 'HBP',
                            'name' => 'HBP',
                            'treated_with' => [
                                ['id' => 'LISINOPRIL', 'name' => 'Lisinopril', 'prescription_count' => 4120],
                            ],
                        ]],
                    ],
                    'spelling_corrections' => [
                        'version' => '3.0',
                        'item_count' => 1,
                        'items' => [[
                            'id' => 'spl_01',
                            'from' => 'HYPRTENSION',
                            'to' => 'HYPERTENSION',
                        ]],
                    ],
                ],
            ],
        ], JSON_THROW_ON_ERROR), ['ETag' => 'W/"abc"']);

        $client = new ZyInsClient(token: self::TOKEN, httpClient: $http);
        $bundle = $client->datasetsV3->get();
        self::assertInstanceOf(DatasetBundleV3::class, $bundle);
        self::assertSame('3.0', $bundle->version);
        self::assertSame('W/"abc"', $bundle->etag);
        self::assertCount(1, $bundle->medications);
        self::assertSame('LISINOPRIL', $bundle->medications[0]->id);
        self::assertSame('HBP', $bundle->medications[0]->usedFor[0]->id);
        self::assertSame(4120, $bundle->medications[0]->usedFor[0]->prescriptionCount);
        self::assertSame(4120, $bundle->conditions[0]->treatedWith[0]->prescriptionCount);
        self::assertSame(['HYPRTENSION' => 'HYPERTENSION'], $bundle->typoMap());
    }

    public function testGetWithIfNoneMatchSends304AsNotModified(): void
    {
        $http = new MockHttpClient();
        $http->queue(304, '', ['ETag' => 'W/"abc"']);

        $client = new ZyInsClient(token: self::TOKEN, httpClient: $http);
        $result = $client->datasetsV3->get(
            DatasetsV3GetOptions::default()->withIfNoneMatch('W/"abc"'),
        );

        self::assertTrue(DatasetsV3NotModified::is($result));
        self::assertInstanceOf(DatasetsV3NotModified::class, $result);
        self::assertSame('W/"abc"', $result->etag);

        $request = $http->lastRequest();
        self::assertSame('GET', $request->getMethod());
        self::assertSame('/v3/datasets', $request->getUri()->getPath());
        self::assertSame('W/"abc"', $request->getHeaderLine('If-None-Match'));
    }

    public function testIncludeAndFieldsBuildExpectedQueryString(): void
    {
        $http = new MockHttpClient();
        $http->queue(200, '{"data":{"version":"3.0"}}');

        $client = new ZyInsClient(token: self::TOKEN, httpClient: $http);
        $client->datasetsV3->get(
            DatasetsV3GetOptions::default()
                ->withInclude([DatasetCategory::Medications, DatasetCategory::Conditions])
                ->withFieldsMeta(),
        );

        $uri = $http->lastRequest()->getUri();
        self::assertSame('/v3/datasets', $uri->getPath());
        self::assertSame('include=medications,conditions&fields=meta', $uri->getQuery());
    }

    public function testGetSurfacesProductSlices(): void
    {
        // A3: products_by_family / discontinued_products / state_derivatives
        // pass through as typed fields; rows missing id/name are skipped.
        $http = new MockHttpClient();
        $http->queue(200, json_encode([
            'data' => [
                'catalog_version' => '3.0',
                'products_by_family' => [
                    'final_expense' => [
                        ['id' => 'prod_001', 'name' => 'Mountain Life MYGA'],
                        ['id' => '', 'name' => 'Empty Id'],
                        ['id' => 42],
                        'nope',
                    ],
                ],
                'discontinued_products' => [
                    'mountain-life-myga' => 1746979200,
                    'float-epoch-ok' => 1746979200.0,
                    'fractional-dropped' => 1746979200.5,
                    'bad' => 'not-a-number',
                ],
                'state_derivatives' => ['ND', 'SD', 7],
            ],
        ], JSON_THROW_ON_ERROR));

        $client = new ZyInsClient(token: self::TOKEN, httpClient: $http);
        $bundle = $client->datasetsV3->get();
        self::assertInstanceOf(DatasetBundleV3::class, $bundle);
        self::assertCount(1, $bundle->productsByFamily['final_expense']);
        self::assertSame('prod_001', $bundle->productsByFamily['final_expense'][0]->id);
        self::assertSame(
            ['mountain-life-myga' => 1746979200, 'float-epoch-ok' => 1746979200],
            $bundle->discontinuedProducts,
        );
        self::assertSame(['ND', 'SD'], $bundle->stateDerivatives);
    }

    public function testGetKeepsIdOnlyRowAndDropsIdLessRow(): void
    {
        // Cross-language keep/drop parity guard. The canonical predicate: a
        // product row is valid iff it has a non-empty `id` (the opaque contract
        // key); a missing/blank `name` defaults to '' and the row is KEPT,
        // while a row with no id is DROPPED. Go/TypeScript/Python/C# all behave
        // identically.
        $http = new MockHttpClient();
        $http->queue(200, json_encode([
            'data' => [
                'catalog_version' => '3.0',
                'products_by_family' => [
                    'final_expense' => [
                        ['id' => 'prod_id_present'], // name absent -> kept, name=''
                        ['name' => 'orphan'],         // id absent -> dropped
                    ],
                ],
            ],
        ], JSON_THROW_ON_ERROR));

        $client = new ZyInsClient(token: self::TOKEN, httpClient: $http);
        $bundle = $client->datasetsV3->get();
        self::assertInstanceOf(DatasetBundleV3::class, $bundle);
        $rows = $bundle->productsByFamily['final_expense'];
        self::assertCount(1, $rows);
        self::assertSame('prod_id_present', $rows[0]->id);
        self::assertSame('', $rows[0]->name);
    }

    public function testGetDropsOutOfRangeEpoch(): void
    {
        // Cross-language int64 epoch-bound parity guard. An integer-valued
        // float epoch that overflows int64 is dropped (never wrapped on the
        // (int) cast); the in-range entry survives. Go/C#/Python/TS agree.
        // 9.3e18 > 2**63. JSON_THROW_ON_ERROR keeps the large value a float.
        $http = new MockHttpClient();
        $http->queue(200, json_encode([
            'data' => [
                'catalog_version' => '3.0',
                'discontinued_products' => [
                    'in-range' => 1746979200,
                    'overflow-skipped' => 9.3e18,
                ],
            ],
        ], JSON_THROW_ON_ERROR));

        $client = new ZyInsClient(token: self::TOKEN, httpClient: $http);
        $bundle = $client->datasetsV3->get();
        self::assertInstanceOf(DatasetBundleV3::class, $bundle);
        self::assertSame(['in-range' => 1746979200], $bundle->discontinuedProducts);
    }

    public function testGetDefaultsProductSlicesToEmpty(): void
    {
        $http = new MockHttpClient();
        $http->queue(200, '{"data":{"catalog_version":"3.0"}}');

        $client = new ZyInsClient(token: self::TOKEN, httpClient: $http);
        $bundle = $client->datasetsV3->get();
        self::assertInstanceOf(DatasetBundleV3::class, $bundle);
        self::assertSame([], $bundle->productsByFamily);
        self::assertSame([], $bundle->discontinuedProducts);
        self::assertSame([], $bundle->stateDerivatives);
    }
}
