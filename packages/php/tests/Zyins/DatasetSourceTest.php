<?php

declare(strict_types=1);

namespace Isa\Sdk\Tests\Zyins;

use Isa\Sdk\Isa;
use Isa\Sdk\Zyins\ApiDatasetSource;
use Isa\Sdk\Zyins\DatasetSourceException;
use Isa\Sdk\Zyins\FileDatasetSource;
use Isa\Sdk\Zyins\Reference\ConceptKind;
use Isa\Sdk\Zyins\Reference\DatasetsV3;
use Isa\Sdk\Zyins\ResolvingDatasetSource;
use Isa\Sdk\Zyins\StaticDatasetSource;
use Isa\Sdk\Zyins\ZyInsClient;
use Psr\Http\Client\ClientInterface;
use Psr\Http\Message\RequestInterface;
use Psr\Http\Message\ResponseInterface;
use PHPUnit\Framework\TestCase;
use RuntimeException;

/**
 * Pluggable DatasetSource — offline reference loads.
 *
 * The headline guarantee: a local source warms `conditions->match(...)`
 * with ZERO network activity. An HTTP client that throws on any call
 * backstops that claim.
 */
final class DatasetSourceTest extends TestCase
{
    private const FIXTURE_JSON = <<<'JSON'
    {
      "object": "datasets_catalog",
      "data": {
        "catalog_version": "fixture-3.0",
        "datasets": {
          "conditions": {
            "version": "fixture-c1",
            "item_count": 1,
            "items": [
              {
                "id": "HIGHBLOODPRESSURE",
                "name": "High Blood Pressure",
                "treated_with": [
                  { "id": "LISINOPRIL", "name": "Lisinopril", "prescription_count": 8200 }
                ]
              }
            ]
          },
          "medications": {
            "version": "fixture-m1",
            "item_count": 1,
            "items": [
              {
                "id": "LISINOPRIL",
                "name": "Lisinopril",
                "used_for": [
                  { "id": "HIGHBLOODPRESSURE", "name": "High Blood Pressure", "prescription_count": 8200 }
                ]
              }
            ]
          }
        }
      }
    }
    JSON;

    private function fixtureSource(): FileDatasetSource
    {
        return new FileDatasetSource(
            '/virtual/reference-bundle.json',
            static fn (string $_path): string => self::FIXTURE_JSON,
        );
    }

    public function testConditionsMatchLoadsFromFileSourceNoNetwork(): void
    {
        $client = new ZyInsClient(
            token: 'isa_test_' . 'OFFLINE0000000000000',
            httpClient: new ExplodingHttpClient(),
            datasetSource: $this->fixtureSource(),
        );

        $hit = $client->conditions->match('high blood pressure');

        self::assertTrue($hit->isKnown());
        self::assertSame(ConceptKind::CONDITION, $hit->kind());
        self::assertSame('HIGHBLOODPRESSURE', $hit->id());
    }

    public function testWithBearerOfflineNeedsNoToken(): void
    {
        $isa = Isa::withBearer(datasets: $this->fixtureSource());

        self::assertSame('LISINOPRIL', $isa->zyins->medications->match('lisinopril')->id());
    }

    public function testFileSourceParsesSlimBundle(): void
    {
        $bundle = $this->fixtureSource()->load();
        self::assertSame('fixture-3.0', $bundle->version);
    }

    public function testFileSourceReadErrorNamesPath(): void
    {
        $source = new FileDatasetSource(
            '/virtual/missing.json',
            static function (string $_path): string {
                throw new RuntimeException('absent');
            },
        );

        $this->expectException(DatasetSourceException::class);
        $this->expectExceptionMessage('/virtual/missing.json');
        $source->load();
    }

    public function testResolvingSourceFirstSuccessWins(): void
    {
        $bad = new FileDatasetSource(
            '/virtual/missing.json',
            static function (string $_path): string {
                throw new RuntimeException('absent');
            },
        );
        $good = new StaticDatasetSource(DatasetsV3::parseEnvelope(self::FIXTURE_JSON, null));
        $chain = new ResolvingDatasetSource([$bad, $good]);

        self::assertSame('fixture-3.0', $chain->load()->version);
    }

    public function testResolvingSourceRunsOnMissingHook(): void
    {
        $ran = false;
        $bad = new FileDatasetSource(
            '/virtual/missing.json',
            static function (string $_path): string {
                throw new RuntimeException('absent');
            },
        );
        $api = new ApiDatasetSource(
            static fn () => DatasetsV3::parseEnvelope(self::FIXTURE_JSON, null),
        );
        $chain = new ResolvingDatasetSource([$bad, $api], function () use (&$ran): void {
            $ran = true;
        });

        $chain->load();
        self::assertTrue($ran);
    }

    public function testResolvingSourceAllFailNamesAttempts(): void
    {
        $bad = new FileDatasetSource(
            '/virtual/a.json',
            static function (string $_path): string {
                throw new RuntimeException('absent');
            },
        );
        $api = new ApiDatasetSource(static function (): never {
            throw new RuntimeException('api down');
        });
        $chain = new ResolvingDatasetSource([$bad, $api]);

        $this->expectException(DatasetSourceException::class);
        $this->expectExceptionMessageMatches('/FileDatasetSource.*ApiDatasetSource/s');
        $chain->load();
    }

    public function testResolvingSourceRejectsEmpty(): void
    {
        $this->expectException(DatasetSourceException::class);
        new ResolvingDatasetSource([]);
    }
}

/** PSR-18 client that throws on any call — proves the offline path stays off the wire. */
final class ExplodingHttpClient implements ClientInterface
{
    public function sendRequest(RequestInterface $request): ResponseInterface
    {
        throw new RuntimeException('network was contacted — offline reference load is broken');
    }
}
