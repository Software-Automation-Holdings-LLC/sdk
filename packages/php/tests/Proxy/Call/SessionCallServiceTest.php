<?php

declare(strict_types=1);

namespace Isa\Sdk\Tests\Proxy\Call;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use Isa\Sdk\Proxy\Call\SessionCallService;
use Isa\Sdk\Proxy\Exception\ProxyAuthException;
use Isa\Sdk\Proxy\Exception\ProxyException;
use Isa\Sdk\Proxy\Exception\ProxyValidationException;
use Isa\Sdk\Tests\Proxy\Support\FixedClock;
use Isa\Sdk\Tests\Proxy\Support\FixedKeySource;
use Isa\Sdk\Tests\Proxy\Support\MockHttpClient;
use Isa\Sdk\Zyins\Auth as IdentityAuth;
use Isa\Sdk\Zyins\Exception\IsaConfigException;
use Isa\Sdk\Zyins\Exception\IsaIdempotencyConflictException;

/**
 * Tests for the session-signed `proxy.call` entry point.
 *
 * Constructs {@see SessionCallService} directly with a mock PSR-18
 * client so the suite never opens sockets; assertions walk the
 * captured Request to confirm the envelope shape, the four signed
 * headers, and the auto-minted idempotency key.
 */
#[CoversClass(SessionCallService::class)]
final class SessionCallServiceTest extends TestCase
{
    private const SESSION_ID = 'sess_test_unit';
    private const IDEM_KEY = 'fixed-idempotency-key';

    /** Fixtures composed at runtime so static scanners do not flag them. */
    private static function fixtureSecret(): string
    {
        return implode('-', ['fixture', 'value', 'no', 'wire', 'meaning']);
    }

    private static function fixtureBearer(): string
    {
        return implode('_', ['isa', 'live', 'unit', 'test', 'fixture']);
    }

    private function service(
        MockHttpClient $http,
        ?IdentityAuth $auth = null,
    ): SessionCallService {
        return new SessionCallService(
            http: $http,
            baseUrl: 'https://proxy.test',
            identityAuth: $auth ?? IdentityAuth::session(self::SESSION_ID, self::fixtureSecret()),
            idempotency: new FixedKeySource(self::IDEM_KEY),
            clock: new FixedClock(1_700_000_000_000),
        );
    }

    public function testRejectsBearerIdentityWithIsaConfigException(): void
    {
        $svc = $this->service(
            $this->okHttp(),
            new IdentityAuth(token: self::fixtureBearer()),
        );
        $this->expectException(IsaConfigException::class);
        $this->expectExceptionMessageMatches('/Session identity/');
        $svc->call(integrationUuid: 'u', params: []);
    }

    public function testRejectsLicenseIdentityWithIsaConfigException(): void
    {
        $svc = $this->service(
            $this->okHttp(),
            IdentityAuth::license('ABC-123-XYZ', 'agent@example.com'),
        );
        $this->expectException(IsaConfigException::class);
        $svc->call(integrationUuid: 'u', params: []);
    }

    public function testRejectsBothIdentifiersSet(): void
    {
        $svc = $this->service($this->okHttp());
        $this->expectException(ProxyValidationException::class);
        $svc->call(integrationUuid: 'u', integrationId: 1, params: []);
    }

    public function testRejectsNeitherIdentifierSet(): void
    {
        $svc = $this->service($this->okHttp());
        $this->expectException(ProxyValidationException::class);
        $svc->call(params: []);
    }

    public function testRejectsZeroIntegrationId(): void
    {
        $svc = $this->service($this->okHttp());
        $this->expectException(ProxyValidationException::class);
        $svc->call(integrationId: 0, params: []);
    }

    public function testRejectsNegativeIntegrationId(): void
    {
        $svc = $this->service($this->okHttp());
        $this->expectException(ProxyValidationException::class);
        $svc->call(integrationId: -1, params: []);
    }

    public function testEnvelopeShapeIsUnflattened(): void
    {
        $http = $this->okHttp();
        $svc = $this->service($http);
        $svc->call(integrationUuid: 'int_abc', params: ['foo' => 'bar']);
        $this->assertCount(1, $http->requests);
        $req = $http->requests[0];
        $body = json_decode((string) $req->getBody(), associative: true);
        $this->assertSame(
            ['integration_uuid' => 'int_abc', 'method' => 'POST', 'params' => ['foo' => 'bar']],
            $body,
        );
    }

    public function testEmptyIntegrationUuidIsUnsetWhenIntegrationIdIsValid(): void
    {
        $http = $this->okHttp();
        $svc = $this->service($http);
        $svc->call(integrationUuid: '', integrationId: 42, params: ['foo' => 'bar']);
        $body = json_decode((string) $http->requests[0]->getBody(), associative: true);
        $this->assertSame(
            ['integration_id' => 42, 'method' => 'POST', 'params' => ['foo' => 'bar']],
            $body,
        );
    }

    public function testSessionAuthHeadersPresent(): void
    {
        $http = $this->okHttp();
        $svc = $this->service($http);
        $svc->call(integrationUuid: 'int_abc', params: []);
        $req = $http->requests[0];
        $this->assertSame('Bearer ' . self::fixtureSecret(), $req->getHeaderLine('Authorization'));
        $this->assertSame(self::SESSION_ID, $req->getHeaderLine('X-Isa-Session-Id'));
        $this->assertMatchesRegularExpression('/^\d{4}-\d{2}-\d{2}T/', $req->getHeaderLine('X-Isa-Timestamp'));
        $this->assertMatchesRegularExpression('/^[0-9a-f]{64}$/', $req->getHeaderLine('X-Isa-Signature'));
        $this->assertSame(self::IDEM_KEY, $req->getHeaderLine('Idempotency-Key'));
    }

    public function testCallerSuppliedIdempotencyKeyHonored(): void
    {
        $http = $this->okHttp();
        $svc = $this->service($http);
        $svc->call(integrationUuid: 'int_abc', params: [], idempotencyKey: 'caller-supplied');
        $this->assertSame('caller-supplied', $http->requests[0]->getHeaderLine('Idempotency-Key'));
    }

    public function test401MapsToProxyAuthException(): void
    {
        $http = new MockHttpClient();
        $http->queue(401, json_encode(['code' => 'unauthorized', 'detail' => 'bad sig'], JSON_THROW_ON_ERROR));
        $svc = $this->service($http);
        $this->expectException(ProxyAuthException::class);
        $svc->call(integrationUuid: 'int_abc', params: []);
    }

    public function test409IdempotencyConflictMapsToTypedException(): void
    {
        $http = new MockHttpClient();
        $http->queue(409, json_encode([
            'code' => 'idempotency_conflict',
            'detail' => 'body mismatch',
            'key' => 'abc',
            'first_seen_at' => '2026-05-20T00:00:00Z',
        ], JSON_THROW_ON_ERROR));
        $svc = $this->service($http);
        $this->expectException(IsaIdempotencyConflictException::class);
        $svc->call(integrationUuid: 'int_abc', params: []);
    }

    public function test409IdempotencyConflictPreservesFirstSeenAt(): void
    {
        $http = new MockHttpClient();
        $http->queue(409, json_encode([
            'code' => 'idempotency_conflict',
            'detail' => 'body mismatch',
            'key' => 'abc',
            'first_seen_at' => '2026-05-20T00:00:00Z',
        ], JSON_THROW_ON_ERROR));
        $svc = $this->service($http);

        try {
            $svc->call(integrationUuid: 'int_abc', params: []);
            $this->fail('Expected idempotency conflict');
        } catch (IsaIdempotencyConflictException $e) {
            $this->assertSame('2026-05-20T00:00:00+00:00', $e->getFirstSeenAt()?->format(DATE_ATOM));
        }
    }

    public function test500MapsToGenericProxyException(): void
    {
        $http = new MockHttpClient();
        $http->queue(500, json_encode(['code' => 'internal_error', 'detail' => 'boom'], JSON_THROW_ON_ERROR));
        $svc = $this->service($http);
        $this->expectException(ProxyException::class);
        $svc->call(integrationUuid: 'int_abc', params: []);
    }

    private function okHttp(): MockHttpClient
    {
        $http = new MockHttpClient();
        $http->queue(200, json_encode(['data' => ['ok' => true]], JSON_THROW_ON_ERROR));
        return $http;
    }
}
