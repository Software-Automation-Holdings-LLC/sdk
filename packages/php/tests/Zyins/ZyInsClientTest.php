<?php

declare(strict_types=1);

namespace Sah\Sdk\Tests\Zyins;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use Sah\Sdk\Tests\Zyins\Support\FixedKeySource;
use Sah\Sdk\Tests\Zyins\Support\MockHttpClient;
use Sah\Sdk\Zyins\Auth;
use Sah\Sdk\Zyins\ZyInsClient;

#[CoversClass(ZyInsClient::class)]
#[CoversClass(Auth::class)]
final class ZyInsClientTest extends TestCase
{
    /**
     * Fixture token; matches the persona format documented in
     * api-standards.md. Not a real credential.
     */
    private const FIXTURE_TOKEN = 'isa_test_' . 'EXAMPLE000000000000000';
    private const FIXTURE_TOKEN_LIVE = 'isa_live_' . 'EXAMPLE000000000000000';

    public function testConstructorRecognizesLiveAndTestPrefixes(): void
    {
        $live = new Auth(self::FIXTURE_TOKEN_LIVE);
        $test = new Auth(self::FIXTURE_TOKEN);
        self::assertTrue($live->isLive());
        self::assertTrue($test->isTest());
        self::assertSame('Bearer ' . self::FIXTURE_TOKEN_LIVE, $live->authorizationHeader());
    }

    public function testAuthRejectsEmptyToken(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        new Auth('');
    }

    public function testClientExposesAllSubServices(): void
    {
        $client = new ZyInsClient(self::FIXTURE_TOKEN);
        self::assertNotNull($client->prequalify);
        self::assertNotNull($client->quote);
        self::assertNotNull($client->datasets);
        self::assertNotNull($client->referenceData);
        self::assertNotNull($client->usage);
    }

    public function testClientAttachesBearerAndVersionHeaders(): void
    {
        $http = new MockHttpClient();
        $http->queue(200, '{"data":{"items":[]},"request_id":"req_01HZK2N5GQR9T8X4B6FJW3Y1AS","object":"list","livemode":false}');
        $client = new ZyInsClient(
            token: self::FIXTURE_TOKEN,
            httpClient: $http,
            idempotency: new FixedKeySource('550e8400-e29b-41d4-a716-446655440000'),
        );
        $client->datasets->list();
        $request = $http->lastRequest();
        self::assertSame('Bearer ' . self::FIXTURE_TOKEN, $request->getHeaderLine('Authorization'));
        self::assertSame(ZyInsClient::DEFAULT_API_VERSION, $request->getHeaderLine('Version'));
        self::assertStringStartsWith('sah-sdk-zyins-php/', $request->getHeaderLine('User-Agent'));
    }
}
