<?php

declare(strict_types=1);

namespace Isa\Sdk\Tests\Zyins;

use Isa\Sdk\Tests\Zyins\Support\FixedKeySource;
use Isa\Sdk\Tests\Zyins\Support\MockHttpClient;
use Isa\Sdk\Zyins\Applicant;
use Isa\Sdk\Zyins\Condition;
use Isa\Sdk\Zyins\Coverage;
use Isa\Sdk\Zyins\Height;
use Isa\Sdk\Zyins\Medication;
use Isa\Sdk\Zyins\NicotineUsage;
use Isa\Sdk\Zyins\Prequalify\Input;
use Isa\Sdk\Zyins\Product;
use Isa\Sdk\Zyins\ProductType;
use Isa\Sdk\Zyins\RequestOptions;
use Isa\Sdk\Zyins\Sex;
use Isa\Sdk\Zyins\Weight;
use Isa\Sdk\Zyins\ZyInsClient;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;

#[CoversClass(\Isa\Sdk\Zyins\Prequalify\Service::class)]
#[CoversClass(\Isa\Sdk\Zyins\Prequalify\Input::class)]
#[CoversClass(\Isa\Sdk\Zyins\Prequalify\Result::class)]
final class PrequalifyServiceTest extends TestCase
{
    private const FIXTURE_TOKEN = 'isa_test_' . 'EXAMPLE000000000000000';

    public function testRunSendsSerializedBodyAndReturnsTypedResult(): void
    {
        $http = new MockHttpClient();
        $http->queue(200, json_encode([
            'object' => 'list',
            'livemode' => false,
            'request_id' => 'req_01HZK2N5GQR9T8X4B6FJW3Y1AS',
            'data' => [
                'plans' => [
                    [
                        'brand' => 'colonial-penn',
                        'tier' => 'preferred-plus',
                        'monthly_premium' => 35.50,
                        'face_value' => 25000,
                        'product_token' => 'colonial-penn.final-expense',
                    ],
                ],
            ],
        ], JSON_THROW_ON_ERROR));

        $client = new ZyInsClient(
            token: self::FIXTURE_TOKEN,
            httpClient: $http,
            idempotency: new FixedKeySource('550e8400-e29b-41d4-a716-446655440000'),
        );

        $input = new Input(
            applicant: new Applicant(
                dob: '1962-04-18',
                sex: Sex::Male,
                height: Height::fromFeetInches(5, 10),
                weight: Weight::fromPounds(195),
                state: 'NC',
                nicotineUse: NicotineUsage::None,
                medications: [new Medication('LOSARTAN', 'HIGH BLOOD PRESSURE', '11 MONTHS AGO', '3 MONTHS AGO')],
                conditions: [new Condition('HBP', '5 YEARS AGO', '3 MONTHS AGO')],
            ),
            coverage: Coverage::faceValue(25000),
            products: [new Product('colonial-penn', ProductType::FinalExpense, 'colonial-penn.final-expense', 'Colonial Penn FE')],
        );

        // Narrow the union — this suite covers the v1 path; the v3 facade
        // routing union (`PrequalifyService|PrequalifyV3`) is exercised in
        // V3FacadeRoutingTest.
        self::assertInstanceOf(\Isa\Sdk\Zyins\Prequalify\Service::class, $client->prequalify);
        $result = $client->prequalify->run($input);

        self::assertCount(1, $result->plans);
        self::assertSame('colonial-penn', $result->plans[0]->brand);
        self::assertSame(35.5, $result->plans[0]->monthlyPremium);
        self::assertSame('req_01HZK2N5GQR9T8X4B6FJW3Y1AS', $result->requestId);

        $request = $http->lastRequest();
        self::assertSame('POST', $request->getMethod());
        self::assertSame('/v1/prequalify', $request->getUri()->getPath());
        self::assertSame('550e8400-e29b-41d4-a716-446655440000', $request->getHeaderLine('Idempotency-Key'));
        $body = json_decode((string) $request->getBody(), true, flags: JSON_THROW_ON_ERROR);
        // 0.5.1 flat wire — no applicant/coverage nesting.
        self::assertSame('1962-04-18', $body['date_of_birth']);
        self::assertSame('male', $body['gender']);
        self::assertSame(70, $body['height']);
        self::assertSame(195, $body['weight']);
        self::assertSame(['colonial-penn.final-expense'], $body['products']);
        self::assertSame('never', $body['nicotine_usage']['last_used']);
        self::assertArrayHasKey('quote_options', $body);
        self::assertArrayNotHasKey('applicant', $body);
        self::assertArrayNotHasKey('coverage', $body);
    }

    public function testWithIdempotencyKeyOverride(): void
    {
        $http = new MockHttpClient();
        $http->queue(200, '{"data":{"plans":[]},"object":"list","livemode":false,"request_id":"req_x"}');
        $client = new ZyInsClient(token: self::FIXTURE_TOKEN, httpClient: $http);

        $input = new Input(
            applicant: new Applicant(
                dob: '1985-11-02',
                sex: Sex::Female,
                height: Height::fromFeetInches(5, 6),
                weight: Weight::fromPounds(140),
                state: 'CA',
                nicotineUse: NicotineUsage::None,
            ),
            coverage: Coverage::monthlyBudget(50),
            products: [new Product('mutual-of-omaha', ProductType::FinalExpense, 'mutual-of-omaha.final-expense', 'Mutual of Omaha FE')],
        );

        $client->prequalify->run($input, RequestOptions::default()->withIdempotencyKey('caller-supplied-key'));
        self::assertSame('caller-supplied-key', $http->lastRequest()->getHeaderLine('Idempotency-Key'));
    }
}
