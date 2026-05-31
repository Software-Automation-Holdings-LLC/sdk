<?php

/**
 * Cross-language SDK parity test.
 *
 * Loads tests/conformance/scenarios.json and verifies that for each scenario
 * the SDK (or raw HTTP, as a fallback) produces a response matching the
 * declared assertion vector. The same JSON drives parametrized tests in every
 * language SDK; drift between SDKs surfaces here.
 *
 * Requires an isa-mock server reachable at ISA_MOCK_URL (defaults to
 * http://127.0.0.1:4010). When the mock is unreachable, every scenario is
 * skipped so local PHPUnit runs don't fail on a developer machine without
 * the mock running.
 */

declare(strict_types=1);

namespace Isa\Sdk\Tests;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class ConformanceScenariosTest extends TestCase
{
    private const DEFAULT_MOCK_URL = 'http://127.0.0.1:4010';

    private const PROBE_TIMEOUT_S = 1;

    private const REQUEST_TIMEOUT_S = 5;

    private const MIN_SCENARIOS = 10;

    private const HEALTH_STATUS_NO_CONTENT = 204;

    public function testScenariosFileLoadsAndHasMinimumCases(): void
    {
        $scenarios = self::loadScenarios();
        self::assertGreaterThanOrEqual(self::MIN_SCENARIOS, count($scenarios));
    }

    #[DataProvider('scenarioProvider')]
    public function testScenarioAgainstIsaMock(array $scenario): void
    {
        $configuredMockUrl = getenv('ISA_MOCK_URL');
        $hasMockUrl = $configuredMockUrl !== false && trim($configuredMockUrl) !== '';
        $mockUrl = $hasMockUrl ? $configuredMockUrl : self::DEFAULT_MOCK_URL;
        if (! self::mockReachable($mockUrl)) {
            if ($hasMockUrl) {
                self::fail("isa-mock unreachable at {$mockUrl}");
            }
            self::markTestSkipped("isa-mock unreachable at {$mockUrl}");
        }

        [$status, $headers, $body] = self::executeScenario($mockUrl, $scenario['request']);
        $expected = $scenario['expected'];

        self::assertSame($expected['status'], $status, "scenario {$scenario['name']} status mismatch (body={$body})");

        $contentType = $headers['content-type'] ?? '';
        if (! empty($expected['content_type'])) {
            self::assertStringContainsString($expected['content_type'], $contentType);
        }
        if (! str_contains($contentType, 'json')) {
            return;
        }

        $payload = json_decode($body, true, flags: JSON_THROW_ON_ERROR);
        self::assertIsArray($payload);
        self::assertScenarioPayload($scenario, $payload);
    }

    public static function scenarioProvider(): array
    {
        $cases = [];
        foreach (self::loadScenarios() as $scenario) {
            $cases[$scenario['name']] = [$scenario];
        }
        return $cases;
    }

    /**
     * @return list<array<string,mixed>>
     */
    private static function loadScenarios(): array
    {
        $path = dirname(__DIR__, 3) . '/tests/conformance/scenarios.json';
        $raw = file_get_contents($path);
        if ($raw === false) {
            self::fail("conformance: could not read {$path}");
        }
        $parsed = json_decode($raw, true, flags: JSON_THROW_ON_ERROR);
        if (! isset($parsed['scenarios']) || ! is_array($parsed['scenarios'])) {
            self::fail("conformance: scenarios.json missing 'scenarios' array");
        }
        return $parsed['scenarios'];
    }

    private static function mockReachable(string $url): bool
    {
        $ctx = stream_context_create(['http' => ['timeout' => self::PROBE_TIMEOUT_S, 'ignore_errors' => true]]);
        @file_get_contents($url . '/__healthz_probe__', false, $ctx);
        $headers = self::parseResponseHeaders($http_response_header ?? []);
        return ($headers['__status'] ?? 0) === self::HEALTH_STATUS_NO_CONTENT;
    }

    /**
     * @param array<string,mixed> $request
     * @return array{0:int,1:array<string,string|int>,2:string}
     */
    private static function executeScenario(string $mockUrl, array $request): array
    {
        $body = null;
        if (isset($request['body_raw'])) {
            $body = (string) $request['body_raw'];
        } elseif (array_key_exists('body', $request) && $request['body'] !== null) {
            $body = json_encode($request['body'], JSON_THROW_ON_ERROR);
        }

        $headerLines = [];
        foreach ((array) ($request['headers'] ?? []) as $key => $value) {
            $headerLines[] = "{$key}: {$value}";
        }

        $opts = [
            'http' => [
                'method' => $request['method'],
                'header' => implode("\r\n", $headerLines),
                'content' => $body ?? '',
                'timeout' => self::REQUEST_TIMEOUT_S,
                'ignore_errors' => true,
            ],
        ];
        $ctx = stream_context_create($opts);
        $url = $mockUrl . $request['path'];
        $respBody = @file_get_contents($url, false, $ctx);
        $headers = self::parseResponseHeaders($http_response_header ?? []);
        $status = $headers['__status'] ?? 0;
        unset($headers['__status']);
        return [(int) $status, $headers, $respBody === false ? '' : $respBody];
    }

    /**
     * @param array<int,string> $rawHeaders
     * @return array<string,string|int>
     */
    private static function parseResponseHeaders(array $rawHeaders): array
    {
        $out = [];
        foreach ($rawHeaders as $line) {
            if (preg_match('#^HTTP/\S+\s+(\d+)#', $line, $m) === 1) {
                $out['__status'] = (int) $m[1];
                continue;
            }
            if (str_contains($line, ':')) {
                [$k, $v] = explode(':', $line, 2);
                $out[strtolower(trim($k))] = trim($v);
            }
        }
        return $out;
    }

    /**
     * @param array<string,mixed> $scenario
     * @param array<string,mixed> $payload
     */
    private static function assertScenarioPayload(array $scenario, array $payload): void
    {
        $expected = $scenario['expected'];
        foreach (($expected['envelope_fields'] ?? []) as $field) {
            self::assertArrayHasKey($field, $payload, "{$scenario['name']}: envelope missing {$field}");
        }
        foreach (($expected['problem_fields'] ?? []) as $field) {
            self::assertArrayHasKey($field, $payload, "{$scenario['name']}: ProblemDetails missing {$field}");
        }
        if (($expected['code'] ?? null) !== null) {
            self::assertSame($expected['code'], $payload['code'] ?? null);
        }
        if (! empty($expected['idempotency_key_echoed'])) {
            $sentKey = $scenario['request']['headers']['X-Isa-Idempotency-Key'] ?? null;
            self::assertNotNull($sentKey, "{$scenario['name']}: request missing idempotency key");
            self::assertArrayHasKey('idempotency_key', $payload, "{$scenario['name']}: envelope missing idempotency_key");
            self::assertSame($sentKey, $payload['idempotency_key'] ?? null);
        }
    }
}
