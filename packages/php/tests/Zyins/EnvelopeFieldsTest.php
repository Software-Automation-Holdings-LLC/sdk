<?php

declare(strict_types=1);

namespace Sah\Sdk\Tests\Zyins;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use Sah\Sdk\Tests\Zyins\Support\FixedKeySource;
use Sah\Sdk\Tests\Zyins\Support\MockHttpClient;
use Sah\Sdk\Zyins\Applicant;
use Sah\Sdk\Zyins\Coverage;
use Sah\Sdk\Zyins\Height;
use Sah\Sdk\Zyins\NicotineUsage;
use Sah\Sdk\Zyins\Prequalify\Input;
use Sah\Sdk\Zyins\Prequalify\Result;
use Sah\Sdk\Zyins\Product;
use Sah\Sdk\Zyins\ProductType;
use Sah\Sdk\Zyins\RawResponse;
use Sah\Sdk\Zyins\RequestOptions;
use Sah\Sdk\Zyins\Sex;
use Sah\Sdk\Zyins\Weight;
use Sah\Sdk\Zyins\ZyInsClient;

#[CoversClass(Result::class)]
#[CoversClass(RawResponse::class)]
#[CoversClass(\Sah\Sdk\Zyins\Prequalify\Service::class)]
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

        $this->expectException(\Sah\Sdk\Zyins\Exception\IsaException::class);
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
