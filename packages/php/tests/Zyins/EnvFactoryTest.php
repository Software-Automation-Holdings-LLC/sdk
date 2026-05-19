<?php

declare(strict_types=1);

namespace Sah\Sdk\Tests\Zyins;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use Sah\Sdk\Zyins\Auth;
use Sah\Sdk\Zyins\Exception\IsaConfigException;
use Sah\Sdk\Zyins\ZyInsClient;

#[CoversClass(ZyInsClient::class)]
#[CoversClass(Auth::class)]
#[CoversClass(IsaConfigException::class)]
final class EnvFactoryTest extends TestCase
{
    /** @var array<string,string|false> */
    private array $savedEnv = [];

    private const KEYS = [
        'ISA_TOKEN',
        'ISA_LICENSE_KEYCODE',
        'ISA_LICENSE_EMAIL',
        'ISA_SESSION_ID',
        'ISA_SESSION_SECRET',
    ];

    protected function setUp(): void
    {
        foreach (self::KEYS as $key) {
            $this->savedEnv[$key] = getenv($key);
            putenv($key);
        }
    }

    protected function tearDown(): void
    {
        foreach (self::KEYS as $key) {
            $prior = $this->savedEnv[$key] ?? false;
            if ($prior === false) {
                putenv($key);
            } else {
                putenv("$key=$prior");
            }
        }
    }

    public function testWithBearerReadsEnvToken(): void
    {
        putenv('ISA_TOKEN=isa_test_FROM_ENV_FIXTURE_VALUE');
        $client = ZyInsClient::withBearer();
        self::assertSame('isa_test_FROM_ENV_FIXTURE_VALUE', $client->auth->token);
        self::assertSame(Auth::SCHEME_BEARER, $client->auth->scheme);
    }

    public function testWithBearerThrowsWhenTokenMissing(): void
    {
        $this->expectException(IsaConfigException::class);
        $this->expectExceptionMessage('ISA_TOKEN');
        ZyInsClient::withBearer();
    }

    public function testWithLicenseReadsBothEnvVars(): void
    {
        putenv('ISA_LICENSE_KEYCODE=ABC-123-XYZ');
        putenv('ISA_LICENSE_EMAIL=john.doe@example.com');
        $client = ZyInsClient::withLicense();
        self::assertSame(Auth::SCHEME_LICENSE, $client->auth->scheme);
        // The token is the base64 packed form so it never appears in
        // logs / URL paths in plaintext.
        $decoded = base64_decode($client->auth->token, strict: true);
        self::assertSame('ABC-123-XYZ:john.doe@example.com', $decoded);
    }

    public function testWithLicenseThrowsWithKeycodeName(): void
    {
        putenv('ISA_LICENSE_EMAIL=john.doe@example.com');
        $this->expectException(IsaConfigException::class);
        $this->expectExceptionMessage('ISA_LICENSE_KEYCODE');
        ZyInsClient::withLicense();
    }

    public function testWithLicenseThrowsWithEmailName(): void
    {
        putenv('ISA_LICENSE_KEYCODE=ABC-123-XYZ');
        $this->expectException(IsaConfigException::class);
        $this->expectExceptionMessage('ISA_LICENSE_EMAIL');
        ZyInsClient::withLicense();
    }

    public function testWithSessionReadsBothEnvVars(): void
    {
        putenv('ISA_SESSION_ID=sess_01HZK2N5GQR9T8X4B6FJW3Y1AS');
        putenv('ISA_SESSION_SECRET=secret_FROM_ENV');
        $client = ZyInsClient::withSession();
        self::assertSame(Auth::SCHEME_SESSION, $client->auth->scheme);
        self::assertSame('sess_01HZK2N5GQR9T8X4B6FJW3Y1AS', $client->auth->token);
    }

    public function testWithSessionThrowsWithIdName(): void
    {
        putenv('ISA_SESSION_SECRET=secret_FROM_ENV');
        $this->expectException(IsaConfigException::class);
        $this->expectExceptionMessage('ISA_SESSION_ID');
        ZyInsClient::withSession();
    }

    public function testWithSessionThrowsWithSecretName(): void
    {
        putenv('ISA_SESSION_ID=sess_x');
        $this->expectException(IsaConfigException::class);
        $this->expectExceptionMessage('ISA_SESSION_SECRET');
        ZyInsClient::withSession();
    }

    public function testExplicitArgsOverrideEnv(): void
    {
        putenv('ISA_TOKEN=isa_test_FROM_ENV');
        $client = ZyInsClient::withBearer('isa_test_FROM_ARG');
        self::assertSame('isa_test_FROM_ARG', $client->auth->token);
    }

    public function testIsaConfigExceptionCarriesCode(): void
    {
        try {
            ZyInsClient::withBearer();
            self::fail('expected IsaConfigException');
        } catch (IsaConfigException $e) {
            self::assertSame('configuration_error', $e->code());
        }
    }
}
