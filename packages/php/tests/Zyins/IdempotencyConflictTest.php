<?php

declare(strict_types=1);

namespace Isa\Sdk\Tests\Zyins;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use Isa\Sdk\Tests\Zyins\Support\MockHttpClient;
use Isa\Sdk\Zyins\Applicant;
use Isa\Sdk\Zyins\Coverage;
use Isa\Sdk\Zyins\Exception\IsaIdempotencyConflictException;
use Isa\Sdk\Zyins\Height;
use Isa\Sdk\Zyins\NicotineUsage;
use Isa\Sdk\Zyins\Prequalify\Input;
use Isa\Sdk\Zyins\Product;
use Isa\Sdk\Zyins\ProductType;
use Isa\Sdk\Zyins\RequestOptions;
use Isa\Sdk\Zyins\Sex;
use Isa\Sdk\Zyins\Weight;
use Isa\Sdk\Zyins\ZyInsClient;

#[CoversClass(IsaIdempotencyConflictException::class)]
#[CoversClass(\Isa\Sdk\Zyins\Transport::class)]
final class IdempotencyConflictTest extends TestCase
{
    public function testServerConflictRaisesTypedException(): void
    {
        $http = new MockHttpClient();
        $http->queue(409, json_encode([
            'code' => 'idempotency_conflict',
            'message' => 'idempotency key reused with different body',
            'key' => '550e8400-e29b-41d4-a716-446655440000',
            'first_seen_at' => '2026-05-14T14:32:01Z',
            'request_id' => 'req_01HZK2N5GQR9T8X4B6FJW3Y1AS',
        ], JSON_THROW_ON_ERROR));

        $client = new ZyInsClient(
            token: 'isa_test_' . 'EXAMPLE000000000000000',
            httpClient: $http,
        );

        try {
            $client->prequalify->run(
                self::sampleInput(),
                RequestOptions::default()->withIdempotencyKey('550e8400-e29b-41d4-a716-446655440000'),
            );
            self::fail('expected IsaIdempotencyConflictException');
        } catch (IsaIdempotencyConflictException $e) {
            self::assertSame('idempotency_conflict', $e->code());
            self::assertSame(409, $e->httpStatus());
            self::assertSame('550e8400-e29b-41d4-a716-446655440000', $e->getKey());
            self::assertNotNull($e->getFirstSeenAt());
            self::assertSame('2026-05-14T14:32:01+00:00', $e->getFirstSeenAt()->format('c'));
            self::assertSame('req_01HZK2N5GQR9T8X4B6FJW3Y1AS', $e->requestId());
        }
    }

    public function testFallsBackToSentKeyWhenServerOmitsIt(): void
    {
        $http = new MockHttpClient();
        $http->queue(409, json_encode([
            'code' => 'idempotency_conflict',
            'message' => 'idempotency key reused with different body',
        ], JSON_THROW_ON_ERROR));

        $client = new ZyInsClient(
            token: 'isa_test_' . 'EXAMPLE000000000000000',
            httpClient: $http,
        );

        try {
            $client->prequalify->run(
                self::sampleInput(),
                RequestOptions::default()->withIdempotencyKey('caller-key-1'),
            );
            self::fail('expected IsaIdempotencyConflictException');
        } catch (IsaIdempotencyConflictException $e) {
            self::assertSame('caller-key-1', $e->getKey());
            self::assertNull($e->getFirstSeenAt());
        }
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
