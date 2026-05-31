<?php

declare(strict_types=1);

namespace Isa\Sdk\Tests\Zyins;

use Isa\Sdk\Tests\Zyins\Support\FixedKeySource;
use Isa\Sdk\Tests\Zyins\Support\MockHttpClient;
use Isa\Sdk\Zyins\Applicant;
use Isa\Sdk\Zyins\Coverage;
use Isa\Sdk\Zyins\Height;
use Isa\Sdk\Zyins\NicotineUsage;
use Isa\Sdk\Zyins\Options\BundledApiVersions;
use Isa\Sdk\Zyins\Prequalify\Service as PrequalifyService;
use Isa\Sdk\Zyins\Product;
use Isa\Sdk\Zyins\ProductType;
use Isa\Sdk\Zyins\Quote\Service as QuoteService;
use Isa\Sdk\Zyins\Reference\PrequalifyV3;
use Isa\Sdk\Zyins\Reference\PrequalifyV3Request;
use Isa\Sdk\Zyins\Reference\QuoteV3;
use Isa\Sdk\Zyins\Reference\QuoteV3Request;
use Isa\Sdk\Zyins\Sex;
use Isa\Sdk\Zyins\Weight;
use Isa\Sdk\Zyins\ZyInsClient;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * Locks the per-surface facade routing exposed by {@see ZyInsClient}:
 *
 *  - With no override (bundled default) `prequalify` and `quote` route
 *    to the v1 services that hit `/v1/prequalify` and `/v1/quote`.
 *  - With `['prequalify' => 'v3']` (and same for `quote`) the namespace
 *    properties route to the v3 callables backed by `/v3/prequalify`
 *    and `/v3/quote`.
 *
 * Mirrors the TS suite in
 * `packages/ts/tests/zyins/bundledApiVersions.test.ts` and the C# /
 * Python equivalents.
 */
#[CoversClass(ZyInsClient::class)]
#[CoversClass(BundledApiVersions::class)]
final class V3FacadeRoutingTest extends TestCase
{
    private const FIXTURE_TOKEN = 'isa_test_' . 'EXAMPLE000000000000000';
    private const FIXTURE_IDEMPOTENCY_KEY = '550e8400-e29b-41d4-a716-446655440000';

    /**
     * @return array<string, array{0: array<string, string>, 1: class-string, 2: class-string}>
     */
    public static function prequalifyRoutingMatrix(): array
    {
        return [
            'bundled default routes to v1 PHP services' => [
                [],
                PrequalifyService::class,
                QuoteService::class,
            ],
            'explicit v1 pin routes to v1 service' => [
                ['prequalify' => 'v1', 'quote' => 'v1'],
                PrequalifyService::class,
                QuoteService::class,
            ],
            'explicit v2 pin matches default routing' => [
                ['prequalify' => 'v2', 'quote' => 'v2'],
                PrequalifyService::class,
                QuoteService::class,
            ],
            'v3 pin on prequalify routes to PrequalifyV3' => [
                ['prequalify' => 'v3'],
                PrequalifyV3::class,
                QuoteService::class,
            ],
            'v3 pin on quote routes to QuoteV3' => [
                ['quote' => 'v3'],
                PrequalifyService::class,
                QuoteV3::class,
            ],
            'v3 pin on both surfaces routes both to v3' => [
                ['prequalify' => 'v3', 'quote' => 'v3'],
                PrequalifyV3::class,
                QuoteV3::class,
            ],
        ];
    }

    /**
     * @param array<string, string> $apiVersionMap
     * @param class-string          $expectedPrequalifyClass
     * @param class-string          $expectedQuoteClass
     */
    #[DataProvider('prequalifyRoutingMatrix')]
    public function testFacadeRoutingByApiVersion(
        array $apiVersionMap,
        string $expectedPrequalifyClass,
        string $expectedQuoteClass,
    ): void {
        $client = new ZyInsClient(
            token: self::FIXTURE_TOKEN,
            apiVersionMap: $apiVersionMap,
        );

        self::assertInstanceOf(
            $expectedPrequalifyClass,
            $client->prequalify,
            'prequalify facade routed to wrong concrete service'
        );
        self::assertInstanceOf(
            $expectedQuoteClass,
            $client->quote,
            'quote facade routed to wrong concrete service'
        );
    }

    public function testPrequalifyAliasIsTheSameInstanceAsPrequalifyV3WhenPinned(): void
    {
        $client = new ZyInsClient(
            token: self::FIXTURE_TOKEN,
            apiVersionMap: ['prequalify' => 'v3'],
        );

        self::assertSame(
            $client->prequalifyV3,
            $client->prequalify,
            'pinned-v3 prequalify must alias the same PrequalifyV3 instance, not allocate a second copy'
        );
    }

    public function testQuoteAliasIsTheSameInstanceAsQuoteV3WhenPinned(): void
    {
        $client = new ZyInsClient(
            token: self::FIXTURE_TOKEN,
            apiVersionMap: ['quote' => 'v3'],
        );

        self::assertSame(
            $client->quoteV3,
            $client->quote,
            'pinned-v3 quote must alias the same QuoteV3 instance, not allocate a second copy'
        );
    }

    public function testV3PinSendsRequestToV3PrequalifyPath(): void
    {
        $http = new MockHttpClient();
        $http->queue(200, json_encode([
            'object' => 'prequalify_result',
            'request_id' => 'req_01HZK2N5GQR9T8X4B6FJW3Y1AS',
            'idempotency_key' => self::FIXTURE_IDEMPOTENCY_KEY,
            'livemode' => true,
            'data' => ['plans' => []],
        ], JSON_THROW_ON_ERROR));

        $client = new ZyInsClient(
            token: self::FIXTURE_TOKEN,
            httpClient: $http,
            idempotency: new FixedKeySource(self::FIXTURE_IDEMPOTENCY_KEY),
            apiVersionMap: ['prequalify' => 'v3'],
        );

        self::assertInstanceOf(PrequalifyV3::class, $client->prequalify);

        $request = new PrequalifyV3Request(
            applicant: self::personaApplicant(),
            coverage: Coverage::faceValue(25000),
            products: self::personaProducts(),
        );

        $result = $client->prequalify->run($request);

        $sent = $http->lastRequest();
        self::assertSame('/v3/prequalify', $sent->getUri()->getPath(), 'v3 pin must route to /v3/prequalify');
        self::assertSame('POST', $sent->getMethod());
        self::assertSame('req_01HZK2N5GQR9T8X4B6FJW3Y1AS', $result->requestId);
        self::assertTrue($result->livemode);
    }

    public function testV3PinSendsRequestToV3QuotePath(): void
    {
        $http = new MockHttpClient();
        $http->queue(200, json_encode([
            'object' => 'quote_result',
            'request_id' => 'req_01HZK2N5GQR9T8X4B6FJW3Y1AS',
            'idempotency_key' => self::FIXTURE_IDEMPOTENCY_KEY,
            'livemode' => true,
            // v3 quote shares the flat `plans[]` envelope with v3 prequalify;
            // an absent plans key is wire-shape drift and now fails fast.
            'data' => ['plans' => []],
        ], JSON_THROW_ON_ERROR));

        $client = new ZyInsClient(
            token: self::FIXTURE_TOKEN,
            httpClient: $http,
            idempotency: new FixedKeySource(self::FIXTURE_IDEMPOTENCY_KEY),
            apiVersionMap: ['quote' => 'v3'],
        );

        self::assertInstanceOf(QuoteV3::class, $client->quote);

        $request = new QuoteV3Request(
            applicant: self::personaApplicant(),
            coverage: Coverage::faceValue(25000),
            products: self::personaProducts(),
        );

        $result = $client->quote->run($request);

        $sent = $http->lastRequest();
        self::assertSame('/v3/quote', $sent->getUri()->getPath(), 'v3 pin must route to /v3/quote');
        self::assertSame('POST', $sent->getMethod());
        self::assertSame('req_01HZK2N5GQR9T8X4B6FJW3Y1AS', $result->requestId);
    }

    public function testV3CalleesAreAlwaysAvailableRegardlessOfPin(): void
    {
        $client = new ZyInsClient(token: self::FIXTURE_TOKEN);
        self::assertInstanceOf(PrequalifyV3::class, $client->prequalifyV3);
        self::assertInstanceOf(QuoteV3::class, $client->quoteV3);
    }

    /**
     * Canonical persona for v3 fixtures — matches `api-standards.md`
     * (John Doe, NC, 5'10", 195 lbs).
     */
    private static function personaApplicant(): Applicant
    {
        return new Applicant(
            dob: '1962-04-18',
            sex: Sex::Male,
            height: Height::fromFeetInches(5, 10),
            weight: Weight::fromPounds(195),
            state: 'NC',
            nicotineUse: NicotineUsage::None,
        );
    }

    /**
     * @return list<Product>
     */
    private static function personaProducts(): array
    {
        return [
            new Product(
                'colonial-penn',
                ProductType::FinalExpense,
                'colonial-penn.final-expense',
                'Colonial Penn FE',
            ),
        ];
    }
}
