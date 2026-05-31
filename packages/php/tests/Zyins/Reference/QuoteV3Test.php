<?php

declare(strict_types=1);

namespace Isa\Sdk\Tests\Zyins\Reference;

use Isa\Sdk\Tests\Zyins\Support\MockHttpClient;
use Isa\Sdk\Zyins\Applicant;
use Isa\Sdk\Zyins\Coverage;
use Isa\Sdk\Zyins\Height;
use Isa\Sdk\Zyins\NicotineUsage;
use Isa\Sdk\Zyins\Product;
use Isa\Sdk\Zyins\ProductType;
use Isa\Sdk\Zyins\Reference\QuoteV3;
use Isa\Sdk\Zyins\Reference\QuoteV3Request;
use Isa\Sdk\Zyins\Sex;
use Isa\Sdk\Zyins\Weight;
use Isa\Sdk\Zyins\ZyInsClient;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;

/**
 * Transport coverage for `POST /v3/quote`. Locks down envelope unwrap
 * and the flat `plans[]` decode into {@see V3Offer} with Money-typed
 * death benefit.
 */
#[CoversClass(QuoteV3::class)]
#[CoversClass(QuoteV3Request::class)]
final class QuoteV3Test extends TestCase
{
    private const TOKEN = 'isa_test_' . 'EXAMPLE000000000000000';

    public function testParsesFlatPlans(): void
    {
        $http = new MockHttpClient();
        $http->queue(200, json_encode([
            'request_id' => 'req_v3q',
            'livemode' => false,
            'data' => [
                'plans' => [
                    [
                        'object' => 'plan_offer',
                        'id' => 'p1',
                        'eligible' => true,
                        'plan_info' => [],
                        'metadata' => [],
                        'carrier' => ['id' => 'c', 'name' => 'C', 'logo_url' => ''],
                        'product' => [
                            'id' => 'pp',
                            'slug' => 's',
                            'name' => 'n',
                            'display_name' => 'dn',
                            'type' => 'term',
                            'wire_token' => 'p|term',
                        ],
                        'death_benefit' => ['amount' => ['cents' => 2500000, 'display' => '$25,000'], 'period' => null],
                        'pricing' => [
                            [
                                'rate_class' => 'A',
                                'primary' => true,
                                'eligibility' => ['category' => 'immediate', 'eligible' => true, 'reasons' => []],
                                'rank' => 1,
                                'premium' => [
                                    'cents' => 4250,
                                    'display' => '$42.50',
                                    'default' => ['cents' => 4250, 'display' => '$42.50'],
                                    'modes' => [],
                                ],
                            ],
                        ],
                    ],
                ],
            ],
        ], JSON_THROW_ON_ERROR));

        $client = new ZyInsClient(token: self::TOKEN, httpClient: $http);
        $result = $client->quoteV3->run(new QuoteV3Request(
            applicant: new Applicant(
                dob: '1962-04-18',
                sex: Sex::Male,
                height: Height::fromFeetInches(5, 10),
                weight: Weight::fromPounds(195),
                state: 'NC',
                nicotineUse: NicotineUsage::None,
            ),
            coverage: Coverage::faceValue(25000),
            products: [new Product('Carrier', ProductType::Term, 'p|term', 'Product')],
        ));

        self::assertSame('req_v3q', $result->requestId);
        self::assertFalse($result->livemode);
        self::assertCount(1, $result->plans);
        $offer = $result->plans[0];
        self::assertSame('plan_offer', $offer->object);
        self::assertSame(2500000, $offer->deathBenefit->amount->cents);
        self::assertNull($offer->deathBenefit->period);
        self::assertCount(1, $offer->pricing);
        self::assertSame('A', $offer->pricing[0]->rateClass);
        self::assertNotNull($offer->pricing[0]->premium);
        self::assertSame(4250, $offer->pricing[0]->premium->cents);

        // Outbound request transport assertions — mirrors PrequalifyV3Test.
        $request = $http->lastRequest();
        self::assertSame('POST', $request->getMethod());
        self::assertSame('/v3/quote', $request->getUri()->getPath());
        self::assertNotSame('', $request->getHeaderLine('Idempotency-Key'));
        self::assertSame('application/json', $request->getHeaderLine('Content-Type'));

        $body = (string) $request->getBody();
        /** @var array<string,mixed> $decoded */
        $decoded = json_decode($body, true, flags: JSON_THROW_ON_ERROR);
        self::assertSame('1962-04-18', $decoded['date_of_birth']);
        self::assertSame('male', $decoded['gender']);
        self::assertSame(['p|term'], $decoded['products']);
        self::assertTrue($decoded['include_ineligible']);
    }

    public function testAbsentPlansFieldThrows(): void
    {
        $http = new MockHttpClient();
        $http->queue(200, '{"object":"quote_result","data":{"other_field":"value"},"request_id":"req_v3q"}');
        $client = new ZyInsClient(token: self::TOKEN, httpClient: $http);

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('missing plans field');
        $client->quoteV3->run($this->request());
    }

    public function testEmptyPlansArrayParsesNoPlans(): void
    {
        $http = new MockHttpClient();
        $http->queue(200, '{"object":"quote_result","data":{"plans":[]},"request_id":"req_v3q","livemode":true}');
        $client = new ZyInsClient(token: self::TOKEN, httpClient: $http);

        $result = $client->quoteV3->run($this->request());

        self::assertSame([], $result->plans);
    }

    private function request(): QuoteV3Request
    {
        return new QuoteV3Request(
            applicant: new Applicant(
                dob: '1962-04-18',
                sex: Sex::Male,
                height: Height::fromFeetInches(5, 10),
                weight: Weight::fromPounds(195),
                state: 'NC',
                nicotineUse: NicotineUsage::None,
            ),
            coverage: Coverage::faceValue(25000),
            products: [new Product('Carrier', ProductType::Term, 'p|term', 'Product')],
        );
    }
}
