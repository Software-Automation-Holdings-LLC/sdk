<?php

declare(strict_types=1);

namespace Isa\Sdk\Tests\Zyins;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use Isa\Sdk\Tests\Zyins\Support\MockHttpClient;
use Isa\Sdk\Zyins\Applicant;
use Isa\Sdk\Zyins\Coverage;
use Isa\Sdk\Zyins\Height;
use Isa\Sdk\Zyins\NicotineUsage;
use Isa\Sdk\Zyins\Prequalify\Input;
use Isa\Sdk\Zyins\Product;
use Isa\Sdk\Zyins\ProductType;
use Isa\Sdk\Zyins\Sex;
use Isa\Sdk\Zyins\Transport;
use Isa\Sdk\Zyins\Weight;
use Isa\Sdk\Zyins\ZyInsClient;

/**
 * The PHP SDK's `Isa` client is readonly and carries no shared mutable
 * state. Per the SDK design (§12), the contract is: 100 concurrent
 * calls on one instance must each see a distinct request id and a
 * distinct auto-minted idempotency key.
 *
 * PHP-FPM and CLI both rely on single-threaded execution per request,
 * but production deployments routinely run the client under
 * amphp/parallel, pthreads, ReactPHP, or fiber-based runtimes — and
 * agents share the same `ZyInsClient` instance across those workers.
 *
 * This suite exercises the "share one client across N callers"
 * pattern. Sub-services are properties on a `readonly` class; the
 * idempotency source produces a fresh UUID per call; the transport
 * builds a brand-new `Request` per call. The assertion is that 100
 * sequential calls (proxying for 100 parallel callers) produce 100
 * distinct idempotency keys and 100 distinct surfaced request ids —
 * no aliasing, no overwritten state.
 */
#[CoversClass(ZyInsClient::class)]
#[CoversClass(Transport::class)]
final class ConcurrencySafetyTest extends TestCase
{
    private const TOKEN = 'isa_test_' . 'EXAMPLE000000000000000';
    private const TOTAL_CALLS = 100;

    public function testHundredCallsProduceDistinctRequestAndIdempotencyKeys(): void
    {
        $http = new MockHttpClient();
        for ($i = 0; $i < self::TOTAL_CALLS; $i++) {
            $http->queue(200, json_encode([
                'request_id' => sprintf('req_01HZK2N5GQR9T8X4B6FJW3Y1A%02d', $i),
                'data' => ['plans' => []],
            ], JSON_THROW_ON_ERROR));
        }

        $client = new ZyInsClient(token: self::TOKEN, httpClient: $http);

        $sentIdempotencyKeys = [];
        $surfacedRequestIds = [];
        for ($i = 0; $i < self::TOTAL_CALLS; $i++) {
            $result = $client->prequalify->run(self::sampleInput());
            $surfacedRequestIds[] = $result->requestId;
            $sentIdempotencyKeys[] = $http->requests[$i]->getHeaderLine('Idempotency-Key');
        }

        self::assertCount(self::TOTAL_CALLS, $http->requests);
        self::assertSame(
            self::TOTAL_CALLS,
            count(array_unique($sentIdempotencyKeys)),
            'each call must auto-mint a distinct idempotency key',
        );
        self::assertSame(
            self::TOTAL_CALLS,
            count(array_unique($surfacedRequestIds)),
            'each surfaced request id must be unique',
        );
    }

    public function testSingleClientIsReusableAcrossNestedCallers(): void
    {
        // A second sanity check: simulate N "workers" each grabbing the
        // shared sub-service property and dispatching. The point is to
        // verify the readonly facade doesn't accidentally mutate any
        // service ref between calls.
        $http = new MockHttpClient();
        for ($i = 0; $i < 10; $i++) {
            $http->queue(200, json_encode([
                'request_id' => 'req_worker_' . $i,
                'data' => ['plans' => []],
            ], JSON_THROW_ON_ERROR));
        }
        $client = new ZyInsClient(token: self::TOKEN, httpClient: $http);

        $workers = array_fill(0, 10, $client->prequalify);
        $ids = [];
        foreach ($workers as $svc) {
            $ids[] = $svc->run(self::sampleInput())->requestId;
        }
        self::assertSame(10, count(array_unique($ids)));
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
