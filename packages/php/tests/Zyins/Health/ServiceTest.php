<?php

declare(strict_types=1);

namespace Sah\Sdk\Tests\Zyins\Health;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use Sah\Sdk\Tests\Zyins\Support\MockHttpClient;
use Sah\Sdk\Zyins\Exception\IsaException;
use Sah\Sdk\Zyins\Health\ProbeResult;
use Sah\Sdk\Zyins\Health\ReadinessResult;
use Sah\Sdk\Zyins\Health\Service as HealthService;
use Sah\Sdk\Zyins\ZyInsClient;

#[CoversClass(HealthService::class)]
#[CoversClass(ReadinessResult::class)]
#[CoversClass(ProbeResult::class)]
final class ServiceTest extends TestCase
{
    private const FIXTURE_TOKEN = 'isa_test_' . 'EXAMPLE000000000000000';

    public function testGetReadinessHappyPath(): void
    {
        $http = new MockHttpClient();
        $http->queue(200, json_encode([
            'ready' => true,
            'status' => 'serving',
            'db' => ['status' => 'serving', 'latency_ms' => 3, 'checked_at' => '2026-05-14T14:32:01Z'],
            'cache' => ['status' => 'serving', 'latency_ms' => 1, 'checked_at' => '2026-05-14T14:32:01Z'],
            'checked_at' => '2026-05-14T14:32:01Z',
        ], JSON_THROW_ON_ERROR));

        $client = new ZyInsClient(token: self::FIXTURE_TOKEN, httpClient: $http);
        $result = $client->health->getReadiness();

        self::assertTrue($result->ready);
        self::assertSame('serving', $result->status);
        self::assertSame(3, $result->db->latencyMs);
        self::assertSame('serving', $result->cache->status);

        $request = $http->lastRequest();
        self::assertSame('GET', $request->getMethod());
        self::assertStringContainsString('/ready', (string) $request->getUri());
    }

    public function testGetReadinessParsesDownstreamMap(): void
    {
        $http = new MockHttpClient();
        $http->queue(200, json_encode([
            'ready' => false,
            'status' => 'not_serving',
            'db' => ['status' => 'serving', 'latency_ms' => 2, 'checked_at' => '2026-05-14T14:32:01Z'],
            'cache' => ['status' => 'not_serving', 'latency_ms' => 0, 'message' => 'connection refused', 'checked_at' => '2026-05-14T14:32:01Z'],
            'downstream_services' => [
                'accounts' => ['status' => 'serving', 'latency_ms' => 5, 'checked_at' => '2026-05-14T14:32:01Z'],
            ],
            'checked_at' => '2026-05-14T14:32:01Z',
        ], JSON_THROW_ON_ERROR));

        $client = new ZyInsClient(token: self::FIXTURE_TOKEN, httpClient: $http);
        $result = $client->health->getReadiness();

        self::assertFalse($result->ready);
        self::assertSame('connection refused', $result->cache->message);
        self::assertSame(5, $result->downstreamServices['accounts']->latencyMs);
    }

    public function testGetReadinessParsesNumericStringLatency(): void
    {
        $http = new MockHttpClient();
        $http->queue(200, json_encode([
            'ready' => true,
            'status' => 'serving',
            'db' => ['status' => 'serving', 'latency_ms' => '300', 'checked_at' => '2026-05-14T14:32:01Z'],
            'cache' => ['status' => 'serving', 'latency_ms' => 1.0, 'checked_at' => '2026-05-14T14:32:01Z'],
            'checked_at' => '2026-05-14T14:32:01Z',
        ], JSON_THROW_ON_ERROR));

        $client = new ZyInsClient(token: self::FIXTURE_TOKEN, httpClient: $http);
        $result = $client->health->getReadiness();

        self::assertSame(300, $result->db->latencyMs);
        self::assertSame(1, $result->cache->latencyMs);
    }

    public function testGetReadinessFailureSurfacesIsaException(): void
    {
        $http = new MockHttpClient();
        $http->queue(503, json_encode(['code' => 'service_unavailable', 'detail' => 'not ready'], JSON_THROW_ON_ERROR));
        $client = new ZyInsClient(token: self::FIXTURE_TOKEN, httpClient: $http);
        $this->expectException(IsaException::class);
        $client->health->getReadiness();
    }
}
