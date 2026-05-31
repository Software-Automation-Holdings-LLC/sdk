<?php

declare(strict_types=1);

namespace Isa\Sdk\Tests\RapidSign;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use Isa\Sdk\RapidSign\Auth;
use Isa\Sdk\RapidSign\Exception\ValidationException;
use Isa\Sdk\RapidSign\RapidSignClient;

#[CoversClass(RapidSignClient::class)]
#[CoversClass(Auth::class)]
final class RapidSignClientTest extends TestCase
{
    private const FIXTURE_TOKEN = 'isa_test_' . 'EXAMPLE000000000000000';
    private const FIXTURE_TOKEN_LIVE = 'isa_live_' . 'EXAMPLE000000000000000';

    public function testAuthRecognizesLiveAndTestPrefixes(): void
    {
        $live = new Auth(self::FIXTURE_TOKEN_LIVE);
        $test = new Auth(self::FIXTURE_TOKEN);
        self::assertTrue($live->isLive());
        self::assertTrue($test->isTest());
        self::assertTrue($live->isRecognizedPrefix());
        self::assertSame('Bearer ' . self::FIXTURE_TOKEN_LIVE, $live->authorizationHeader());
    }

    public function testAuthRejectsWhitespaceOnlyToken(): void
    {
        $this->expectException(ValidationException::class);
        new Auth('   ');
    }

    public function testAuthTrimsSurroundingWhitespace(): void
    {
        $auth = new Auth('  	' . self::FIXTURE_TOKEN . '  
');
        self::assertSame(self::FIXTURE_TOKEN, $auth->token);
    }

    public function testDefaultUserAgentIncludesPackageAndPhpVersion(): void
    {
        $ua = RapidSignClient::defaultUserAgent();
        self::assertStringContainsString('sah-sdk-rapidsign-php/' . RapidSignClient::PACKAGE_VERSION, $ua);
        self::assertStringContainsString('php/' . PHP_VERSION, $ua);
    }

    public function testAuthRejectsEmptyToken(): void
    {
        $this->expectException(ValidationException::class);
        new Auth('');
    }

    public function testClientExposesAllSubServices(): void
    {
        $client = new RapidSignClient(self::FIXTURE_TOKEN);
        self::assertNotNull($client->documents);
        self::assertNotNull($client->webhooks);
        self::assertNotNull($client->auth);
    }
}
