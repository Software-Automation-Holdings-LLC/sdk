<?php

declare(strict_types=1);

namespace Isa\Sdk\Tests\Zyins\Reference;

use Isa\Sdk\Tests\Zyins\Support\MockHttpClient;
use Isa\Sdk\Zyins\Reference\DatasetBundleV3;
use Isa\Sdk\Zyins\Reference\DatasetsV3;
use Isa\Sdk\Zyins\ZyInsClient;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * Cross-language parse-parity conformance for the v3 datasets product-slice
 * fields. Drives the same corpus
 * (`shared/schemas/sdk/testdata/datasets_v3_parse_conformance.json`) the
 * Go / TypeScript / Python / C# SDKs assert against, so drift between
 * languages on empty-vs-absent, the non-empty-id keep predicate, the blank-name
 * default, the non-array-family skip, or the int64 epoch bound surfaces here.
 */
#[CoversClass(DatasetsV3::class)]
final class DatasetsV3ParseConformanceTest extends TestCase
{
    private const TOKEN = 'isa_test_' . 'EXAMPLE000000000000000';

    /**
     * @param array<string,mixed> $responseBody
     * @param array<string,mixed> $expected
     */
    #[DataProvider('scenarios')]
    public function testParseConformance(array $responseBody, array $expected): void
    {
        $http = new MockHttpClient();
        $http->queue(200, json_encode($responseBody, JSON_THROW_ON_ERROR));

        $client = new ZyInsClient(token: self::TOKEN, httpClient: $http);
        $bundle = $client->datasetsV3->get();
        self::assertInstanceOf(DatasetBundleV3::class, $bundle);

        self::assertSame($expected['version'], $bundle->version);

        $gotFamilies = [];
        foreach ($bundle->productsByFamily as $family => $rows) {
            $gotFamilies[$family] = array_map(
                static fn ($r): array => ['id' => $r->id, 'name' => $r->name],
                $rows,
            );
        }
        self::assertSame($expected['products_by_family'], $gotFamilies);

        self::assertSame($expected['discontinued_products'], $bundle->discontinuedProducts);
        self::assertSame($expected['state_derivatives'], $bundle->stateDerivatives);
    }

    /**
     * @return iterable<string,array{0:array<string,mixed>,1:array<string,mixed>}>
     */
    public static function scenarios(): iterable
    {
        $path = __DIR__ . '/../../../../../shared/schemas/sdk/testdata/datasets_v3_parse_conformance.json';
        $raw = file_get_contents($path);
        if ($raw === false) {
            self::fail('datasets_v3_parse_conformance.json not found at ' . $path);
        }
        $corpus = json_decode($raw, associative: true, flags: JSON_THROW_ON_ERROR);
        foreach ($corpus['scenarios'] as $scenario) {
            yield $scenario['name'] => [$scenario['response_body'], $scenario['expected']];
        }
    }
}
