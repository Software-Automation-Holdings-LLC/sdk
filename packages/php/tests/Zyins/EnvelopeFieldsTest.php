<?php

declare(strict_types=1);

namespace Isa\Sdk\Tests\Zyins;

use Isa\Sdk\Tests\Zyins\Support\FixedKeySource;
use Isa\Sdk\Tests\Zyins\Support\MockHttpClient;
use Isa\Sdk\Zyins\Applicant;
use Isa\Sdk\Zyins\Coverage;
use Isa\Sdk\Zyins\Height;
use Isa\Sdk\Zyins\NicotineUsage;
use Isa\Sdk\Zyins\Prequalify\Input;
use Isa\Sdk\Zyins\Prequalify\Result;
use Isa\Sdk\Zyins\Product;
use Isa\Sdk\Zyins\ProductType;
use Isa\Sdk\Zyins\RawResponse;
use Isa\Sdk\Zyins\RequestOptions;
use Isa\Sdk\Zyins\Sex;
use Isa\Sdk\Zyins\Weight;
use Isa\Sdk\Zyins\ZyInsClient;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;

#[CoversClass(Result::class)]
#[CoversClass(RawResponse::class)]
#[CoversClass(\Isa\Sdk\Zyins\Prequalify\Service::class)]
final class EnvelopeFieldsTest extends TestCase
{
    private const TOKEN = 'isa_test_' . 'EXAMPLE000000000000000';

    public function testResultExposesEnvelopeFields(): void
    {
        $http = new MockHttpClient();
        $http->queue(200, json_encode([
            'object' => 'list',
            'livemode' => false,
            'request_id' => 'req_01HZK2N5GQR9T8X4B6FJW3Y1AS',
            'idempotency_key' => '550e8400-e29b-41d4-a716-446655440000',
            'retry_attempts' => 2,
            'data' => ['plans' => []],
        ], JSON_THROW_ON_ERROR));

        $client = new ZyInsClient(
            token: self::TOKEN,
            httpClient: $http,
            idempotency: new FixedKeySource('550e8400-e29b-41d4-a716-446655440000'),
        );

        $result = $client->prequalify->run(self::sampleInput());

        self::assertSame('req_01HZK2N5GQR9T8X4B6FJW3Y1AS', $result->requestId);
        self::assertSame('550e8400-e29b-41d4-a716-446655440000', $result->idempotencyKey);
        self::assertSame(2, $result->retryAttempts);
    }

    public function testIdempotencyKeyFallsBackToSentHeaderWhenServerOmits(): void
    {
        $http = new MockHttpClient();
        $http->queue(200, json_encode([
            'request_id' => 'req_x',
            'data' => ['plans' => []],
        ], JSON_THROW_ON_ERROR));

        $client = new ZyInsClient(
            token: self::TOKEN,
            httpClient: $http,
            idempotency: new FixedKeySource('aaaa-bbbb-cccc-dddd'),
        );

        $result = $client->prequalify->run(self::sampleInput());

        self::assertSame('aaaa-bbbb-cccc-dddd', $result->idempotencyKey);
        self::assertSame(0, $result->retryAttempts);
    }

    public function testWithRawResponseReturnsRawAlongsideResult(): void
    {
        $http = new MockHttpClient();
        $http->queue(
            200,
            json_encode([
                'request_id' => 'req_y',
                'data' => ['plans' => []],
            ], JSON_THROW_ON_ERROR),
            ['X-Custom-Header' => 'custom-value', 'Content-Type' => 'application/json'],
        );

        $client = new ZyInsClient(token: self::TOKEN, httpClient: $http);
        // Narrow the v1/v3 facade-routing union — this assertion covers the
        // v1 service shape.
        self::assertInstanceOf(\Isa\Sdk\Zyins\Prequalify\Service::class, $client->prequalify);
        [$result, $raw] = $client->prequalify->runWithRawResponse(self::sampleInput());

        self::assertInstanceOf(Result::class, $result);
        self::assertInstanceOf(RawResponse::class, $raw);
        self::assertSame(200, $raw->status);
        self::assertSame('custom-value', $raw->header('X-Custom-Header'));
        self::assertSame('custom-value', $raw->header('x-custom-header'));
        self::assertStringContainsString('/v1/prequalify', $raw->url);
        self::assertNotSame('', $raw->body);
    }

    public function testWithRawResponseStillThrowsOnError(): void
    {
        $http = new MockHttpClient();
        $http->queue(500, json_encode(['code' => 'internal_error', 'message' => 'boom'], JSON_THROW_ON_ERROR));
        $client = new ZyInsClient(token: self::TOKEN, httpClient: $http);
        self::assertInstanceOf(\Isa\Sdk\Zyins\Prequalify\Service::class, $client->prequalify);

        $this->expectException(\Isa\Sdk\Zyins\Exception\IsaException::class);
        $client->prequalify->runWithRawResponse(
            self::sampleInput(),
            RequestOptions::default()->withIdempotencyKey('k'),
        );
    }

    private static function sampleInput(): Input
    {
        return new Input(
            applicant: new Applicant(
                dob: '1962-04-18',
                sex: Sex::Male,
                height: Height::fromFeetInches(5, 10),
                weight: Weight::fromPounds(195),
                state: 'NC',
                nicotineUse: NicotineUsage::None,
            ),
            coverage: Coverage::faceValue(25000),
            products: [new Product('colonial-penn', ProductType::FinalExpense, 'colonial-penn.final-expense', 'Colonial Penn FE')],
        );
    }
}
