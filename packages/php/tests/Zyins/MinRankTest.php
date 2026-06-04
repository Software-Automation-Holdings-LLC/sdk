<?php

declare(strict_types=1);

namespace Isa\Sdk\Tests\Zyins;

use Isa\Sdk\Tests\Zyins\Support\MockHttpClient;
use Isa\Sdk\Zyins\Applicant;
use Isa\Sdk\Zyins\Coverage;
use Isa\Sdk\Zyins\Height;
use Isa\Sdk\Zyins\MinRank;
use Isa\Sdk\Zyins\NicotineUsage;
use Isa\Sdk\Zyins\Product;
use Isa\Sdk\Zyins\Reference\PrequalifyV3Options;
use Isa\Sdk\Zyins\Reference\QuoteV3Request;
use Isa\Sdk\Zyins\Sex;
use Isa\Sdk\Zyins\Weight;
use Isa\Sdk\Zyins\ZyInsClient;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

#[CoversClass(MinRank::class)]
final class MinRankTest extends TestCase
{
    // Persona token (documentation literal, not a credential); concatenated
    // to keep secret scanners quiet, mirroring the sibling V3 tests.
    private const TOKEN = 'isa_test_' . 'EXAMPLE000000000000000';

    /**
     * @return iterable<string, array{0: string, 1: string}>
     */
    public static function canonicalTokens(): iterable
    {
        yield 'immediate' => [MinRank::IMMEDIATE, 'immediate'];
        yield 'graded' => [MinRank::GRADED, 'graded'];
        yield 'rop' => [MinRank::ROP, 'rop'];
        yield 'guaranteed' => [MinRank::GUARANTEED, 'guaranteed'];
    }

    #[DataProvider('canonicalTokens')]
    public function testCanonicalConstantMapsToLowercaseWireToken(string $constant, string $wireToken): void
    {
        self::assertSame($wireToken, $constant);
    }

    public function testSynonymsCollapseOntoCanonicalToken(): void
    {
        self::assertSame(MinRank::ROP, MinRank::RETURN_OF_PREMIUM);
        self::assertSame(MinRank::GUARANTEED, MinRank::GUARANTEED_ISSUE);
        self::assertSame(MinRank::GUARANTEED, MinRank::GI);
    }

    public function testOptionFieldAcceptsConstantAsString(): void
    {
        $options = new PrequalifyV3Options(minRank: MinRank::GI);
        self::assertSame('guaranteed', $options->minRank);
    }

    /**
     * @return iterable<string, array{0: string, 1: string}>
     */
    public static function wireTokens(): iterable
    {
        yield 'immediate' => [MinRank::IMMEDIATE, 'immediate'];
        yield 'graded' => [MinRank::GRADED, 'graded'];
        yield 'rop' => [MinRank::ROP, 'rop'];
        yield 'guaranteed' => [MinRank::GUARANTEED, 'guaranteed'];
        yield 'return_of_premium synonym' => [MinRank::RETURN_OF_PREMIUM, 'rop'];
        yield 'guaranteed_issue synonym' => [MinRank::GUARANTEED_ISSUE, 'guaranteed'];
        yield 'gi synonym' => [MinRank::GI, 'guaranteed'];
    }

    /**
     * Each canonical constant and synonym serializes to its lowercase wire
     * token under `min_rank`. Driven through the real quote serializer (the
     * /v3/quote path, which carries min_rank) so a divergence fails this
     * language's own CI. Mirrors the Go/Python/TS/C# wire-shape suites.
     */
    #[DataProvider('wireTokens')]
    public function testSerializesMinRankWireToken(string $option, string $wireToken): void
    {
        $http = new MockHttpClient();
        $http->queue(200, '{"data":{"plans":[]},"request_id":"req_x"}');

        $client = new ZyInsClient(token: self::TOKEN, httpClient: $http);
        $client->quoteV3->run(
            new QuoteV3Request(
                applicant: new Applicant(
                    dob: '1962-04-18',
                    sex: Sex::Male,
                    height: Height::fromFeetInches(5, 10),
                    weight: Weight::fromPounds(195),
                    state: 'NC',
                    nicotineUse: NicotineUsage::None,
                ),
                coverage: Coverage::faceValue(25000),
                products: [new Product(id: 'prod_p_fixture', name: 'Product', class: 'term', carrier: 'Carrier')],
                options: new PrequalifyV3Options(minRank: $option),
            ),
        );

        $body = (string) $http->lastRequest()->getBody();
        /** @var array<string,mixed> $decoded */
        $decoded = json_decode($body, true, flags: JSON_THROW_ON_ERROR);
        self::assertSame($wireToken, $decoded['min_rank']);
    }
}
