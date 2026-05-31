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
use Isa\Sdk\Zyins\Reference\PrequalifyV3;
use Isa\Sdk\Zyins\Reference\V3Offer;
use Isa\Sdk\Zyins\Reference\PrequalifyV3Request;
use Isa\Sdk\Zyins\Reference\V3EligibilityCategory;
use Isa\Sdk\Zyins\Reference\V3PricingRow;
use Isa\Sdk\Zyins\RequestOptions;
use Isa\Sdk\Zyins\Sex;
use Isa\Sdk\Zyins\Weight;
use Isa\Sdk\Zyins\ZyInsClient;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;

/**
 * Transport coverage for `POST /v3/prequalify`. Locks down the wire
 * body shape (JSON keys, integer cents) and the parser's projection
 * into typed value objects.
 */
#[CoversClass(PrequalifyV3::class)]
#[CoversClass(PrequalifyV3Request::class)]
#[CoversClass(V3Offer::class)]
final class PrequalifyV3Test extends TestCase
{
    private const TOKEN = 'isa_test_' . 'EXAMPLE000000000000000';

    public function testParsesUniformPricingTable(): void
    {
        $http = new MockHttpClient();
        $http->queue(200, json_encode([
            'object' => 'prequalify_result',
            'request_id' => 'req_v3p',
            'idempotency_key' => '550e8400-e29b-41d4-a716-446655440000',
            'livemode' => true,
            'data' => [
                'plans' => [
                    [
                        'id' => 'plan-a',
                        'eligible' => true,
                        'carrier' => ['id' => 'crr', 'name' => 'Carrier', 'logo_url' => ''],
                        'product' => [
                            'id' => 'prod',
                            'slug' => 'p',
                            'name' => 'P',
                            'display_name' => 'Product',
                            'type' => 'term',
                            'wire_token' => 'p|term',
                        ],
                        'plan_info' => [],
                        'death_benefit' => ['amount' => ['cents' => 2500000, 'display' => '$25,000'], 'period' => null],
                        'pricing' => [
                            [
                                'rate_class' => 'IMMEDIATE',
                                'primary' => true,
                                'eligibility' => ['category' => 'immediate', 'eligible' => true, 'reasons' => []],
                                'rank' => 1,
                                'premium' => [
                                    'cents' => 4250,
                                    'display' => '$42.50',
                                    'default' => ['cents' => 4250, 'display' => '$42.50'],
                                    'modes' => [
                                        'MONTHLY-EFT' => ['cents' => 4250, 'display' => '$42.50'],
                                        'ANNUAL' => ['cents' => 51000, 'display' => '$510.00'],
                                    ],
                                ],
                            ],
                            [
                                'rate_class' => 'GRADED',
                                'primary' => false,
                                'eligibility' => ['category' => 'graded', 'eligible' => false, 'reasons' => ['bmi']],
                                'rank' => null,
                            ],
                        ],
                        'metadata' => ['underwriting' => 'live'],
                    ],
                ],
            ],
        ], JSON_THROW_ON_ERROR));

        $client = new ZyInsClient(token: self::TOKEN, httpClient: $http);
        $result = $client->prequalifyV3->run(
            new PrequalifyV3Request(
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
            ),
            RequestOptions::default()->withIdempotencyKey('550e8400-e29b-41d4-a716-446655440000'),
        );

        self::assertSame('req_v3p', $result->requestId);
        self::assertSame('550e8400-e29b-41d4-a716-446655440000', $result->idempotencyKey);
        self::assertTrue($result->livemode);
        self::assertCount(1, $result->plans);
        $offer = $result->plans[0];
        self::assertSame('plan_offer', $offer->object);
        self::assertSame(2500000, $offer->deathBenefit->amount->cents);
        self::assertNull($offer->deathBenefit->period);
        self::assertNull($offer->budget);
        self::assertCount(2, $offer->pricing);

        $primary = $offer->pricing[0];
        self::assertInstanceOf(V3PricingRow::class, $primary);
        self::assertSame('IMMEDIATE', $primary->rateClass);
        self::assertTrue($primary->primary);
        self::assertSame(V3EligibilityCategory::Immediate, $primary->eligibility->category);
        self::assertTrue($primary->eligibility->eligible);
        self::assertNotNull($primary->premium);
        self::assertSame(4250, $primary->premium->cents);
        self::assertSame(51000, $primary->premium->modes['ANNUAL']->cents);

        $graded = $offer->pricing[1];
        self::assertSame('GRADED', $graded->rateClass);
        self::assertFalse($graded->eligibility->eligible);
        self::assertNull($graded->premium);
        self::assertNull($graded->rank);
    }

    public function testSerializesWireBodyWithV3Defaults(): void
    {
        $http = new MockHttpClient();
        $http->queue(200, '{"data":{"plans":[]},"request_id":"req_x"}');

        $client = new ZyInsClient(token: self::TOKEN, httpClient: $http);
        $client->prequalifyV3->run(
            new PrequalifyV3Request(
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
            ),
        );

        $request = $http->lastRequest();
        self::assertSame('POST', $request->getMethod());
        self::assertSame('/v3/prequalify', $request->getUri()->getPath());
        self::assertNotSame('', $request->getHeaderLine('Idempotency-Key'));
        self::assertSame('v3', $request->getHeaderLine('Api-Version'));

        $body = (string) $request->getBody();
        /** @var array<string,mixed> $decoded */
        $decoded = json_decode($body, true, flags: JSON_THROW_ON_ERROR);
        // v3 prequalify envelope shape: `applicant`, `coverage`,
        // `products[]`. The v2-flat shape (`date_of_birth` / `gender`
        // at the root) was rejected by the server with `unknown field
        // "date_of_birth"` (prod incident, 2026-05-29).
        self::assertArrayHasKey('applicant', $decoded);
        self::assertArrayHasKey('coverage', $decoded);
        self::assertArrayNotHasKey('date_of_birth', $decoded);
        self::assertArrayNotHasKey('gender', $decoded);
        self::assertArrayNotHasKey('quote_options', $decoded);

        $applicant = $decoded['applicant'];
        self::assertSame('male', $applicant['sex']);
        self::assertSame('1962-04-18', $applicant['dob']);
        self::assertSame(70, $applicant['height_inches']);
        self::assertSame(195, $applicant['weight_lbs']);
        self::assertSame(['last_used' => 'never'], $applicant['nicotine']);

        $coverage = $decoded['coverage'];
        self::assertSame(2500000, $coverage['face_amount_cents']);
        self::assertSame('NC', $coverage['state']);

        self::assertSame(['p|term'], $decoded['products']);
        self::assertTrue($decoded['include_ineligible']);
    }

    public function testEmitsV3EnvelopeWithConditionsMedicationsAndSpecificity(): void
    {
        $http = new MockHttpClient();
        $http->queue(200, '{"data":{"plans":[]},"request_id":"req_x"}');

        $client = new ZyInsClient(token: self::TOKEN, httpClient: $http);
        $client->prequalifyV3->run(
            new PrequalifyV3Request(
                applicant: new Applicant(
                    dob: '1962-04-18',
                    sex: Sex::Male,
                    height: Height::fromFeetInches(5, 10),
                    weight: Weight::fromPounds(195),
                    state: 'NC',
                    nicotineUse: new \Isa\Sdk\Zyins\NicotineUsageInput(
                        \Isa\Sdk\Zyins\NicotineDuration::Within12Months,
                        [new \Isa\Sdk\Zyins\NicotineProductUsage('Marijuana', 'WEEKLY')],
                    ),
                    conditions: [new \Isa\Sdk\Zyins\Condition(
                        name: 'High Blood Pressure',
                        wasDiagnosed: '5 YEARS AGO',
                        lastTreatment: '2 MONTHS AGO',
                    )],
                    medications: [new \Isa\Sdk\Zyins\Medication(
                        name: 'Lisinopril',
                        use: 'High Blood Pressure',
                        firstFill: '5 YEARS AGO',
                        lastFill: '1 MONTH AGO',
                    )],
                ),
                coverage: Coverage::faceValue(50000),
                products: [new Product('Carrier', ProductType::Term, 'p|term', 'Product')],
            ),
        );

        $body = (string) $http->lastRequest()->getBody();
        /** @var array<string,mixed> $decoded */
        $decoded = json_decode($body, true, flags: JSON_THROW_ON_ERROR);

        $applicant = $decoded['applicant'];
        self::assertSame(
            [['text' => 'High Blood Pressure', 'was_diagnosed' => '5 YEARS AGO', 'last_treatment' => '2 MONTHS AGO']],
            $applicant['conditions'],
        );
        self::assertSame(
            [['text' => 'Lisinopril', 'use' => 'High Blood Pressure', 'first_fill' => '5 YEARS AGO', 'last_fill' => '1 MONTH AGO']],
            $applicant['medications'],
        );
        self::assertSame(
            [
                'last_used' => 'within_12_months',
                'specificity' => [['text' => 'Marijuana', 'frequency' => 'few_times_per_week']],
            ],
            $applicant['nicotine'],
        );
        self::assertSame(5000000, $decoded['coverage']['face_amount_cents']);
    }

    public function testSingleMonthlyBudgetSerializesQuoteOptions(): void
    {
        $http = new MockHttpClient();
        $http->queue(200, '{"object":"prequalify_result","data":{"plans":[]},"request_id":"req_x","livemode":true}');
        $client = new ZyInsClient(token: self::TOKEN, httpClient: $http);

        // A SINGLE $50/month budget rides coverage.quote_options with one
        // amount and the monthly_budget discriminator — it must NOT throw,
        // and must NOT serialize as a $50 face amount.
        $client->prequalifyV3->run(
            new PrequalifyV3Request(
                applicant: new Applicant(
                    dob: '1962-04-18',
                    sex: Sex::Male,
                    height: Height::fromFeetInches(5, 10),
                    weight: Weight::fromPounds(195),
                    state: 'NC',
                    nicotineUse: NicotineUsage::None,
                ),
                coverage: Coverage::monthlyBudget(50),
                products: [new Product('Carrier', ProductType::Term, 'p|term', 'Product')],
            ),
        );

        $body = (string) $http->lastRequest()->getBody();
        /** @var array<string,mixed> $decoded */
        $decoded = json_decode($body, true, flags: JSON_THROW_ON_ERROR);
        $coverage = $decoded['coverage'];
        self::assertArrayNotHasKey('face_amount_cents', $coverage);
        self::assertSame(
            ['quote_type' => 'monthly_budget', 'amounts' => ['50']],
            $coverage['quote_options'],
        );
    }

    public function testDoesNotDuplicateApiVersionHeaderWhenCallerSuppliesLowercase(): void
    {
        $http = new MockHttpClient();
        $http->queue(200, '{"data":{"plans":[]},"request_id":"req_x"}');

        $client = new ZyInsClient(token: self::TOKEN, httpClient: $http);
        $client->prequalifyV3->run(
            new PrequalifyV3Request(
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
            ),
            RequestOptions::default()->withExtraHeaders(['api-version' => 'v9']),
        );

        // The caller's lowercase header wins; the SDK must not append a
        // second conflicting `Api-Version` value (HTTP header names are
        // case-insensitive per RFC 9110 §5.1).
        self::assertSame('v9', $http->lastRequest()->getHeaderLine('Api-Version'));
    }
}
