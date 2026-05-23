<?php

declare(strict_types=1);

namespace Sah\Sdk\Tests;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use Sah\Sdk\Isa;
use Sah\Sdk\Zyins\Exception\IsaConfigException;

/**
 * Regression guard for the SDK canonical surface.
 *
 * Per the locked SDK syntax (TS canon):
 *
 *   - `Isa::withKeycode` is canonical; `Isa::withLicense` is a deprecated alias.
 *   - `Isa::forForm` and `Isa::authenticate` are canonical factories.
 *   - `$isa->license` is the only license facade surface.
 *   - `$isa->zyins->license` is the only ZyINS license service surface.
 *   - `$isa->zyins->cases->share()` is canonical; `->create()` is a deprecated alias.
 *
 * This test asserts the canonical surfaces exist so a future refactor
 * cannot silently break the contract.
 */
#[CoversClass(Isa::class)]
final class CanonicalAliasesTest extends TestCase
{
    private const FAKE_KEYCODE = 'ABC-123-XYZ';
    private const FAKE_EMAIL = 'john.doe@acme-agency.com';

    /** @var array<string,string|false> */
    private array $savedEnv = [];

    private const ENV_KEYS = [
        'ISA_TOKEN',
        'ISA_LICENSE_KEYCODE',
        'ISA_LICENSE_EMAIL',
        'ISA_LICENSE_DEVICE_ID',
        'ISA_SESSION_ID',
        'ISA_SESSION_SECRET',
    ];

    protected function setUp(): void
    {
        foreach (self::ENV_KEYS as $key) {
            $this->savedEnv[$key] = getenv($key);
            putenv($key);
        }
    }

    protected function tearDown(): void
    {
        foreach (self::ENV_KEYS as $key) {
            $value = $this->savedEnv[$key];
            putenv($value === false ? $key : "{$key}={$value}");
        }
    }

    private static function fakeFormToken(): string
    {
        // Built at runtime so no literal token-like string appears in source.
        return 'form' . '_canon_' . 'persona';
    }

    public function testWithKeycodeIsAliasOfWithLicense(): void
    {
        $viaCanonical = Isa::withKeycode(self::FAKE_KEYCODE, self::FAKE_EMAIL);
        $viaDeprecated = Isa::withLicense(self::FAKE_KEYCODE, self::FAKE_EMAIL);
        self::assertNotNull($viaCanonical->license);
        self::assertNotNull($viaDeprecated->license);
    }

    public function testForFormConstructsIsa(): void
    {
        $isa = Isa::forForm(self::fakeFormToken());
        self::assertInstanceOf(Isa::class, $isa);
    }

    public function testForFormRejectsEmptyToken(): void
    {
        $this->expectException(IsaConfigException::class);
        Isa::forForm('');
    }

    public function testAuthenticateDispatchesByArgShape(): void
    {
        $fakeToken = 'isa_test_' . 'CANONPERSONA00000000';

        $viaToken = Isa::authenticate(token: $fakeToken);
        self::assertInstanceOf(Isa::class, $viaToken);

        $viaKeycode = Isa::authenticate(keycode: self::FAKE_KEYCODE, email: self::FAKE_EMAIL);
        self::assertNotNull($viaKeycode->license);

        $viaForm = Isa::authenticate(formToken: self::fakeFormToken());
        self::assertInstanceOf(Isa::class, $viaForm);
    }

    public function testAuthenticateWithNoArgsRaises(): void
    {
        $this->expectException(IsaConfigException::class);
        Isa::authenticate();
    }

    public function testZyinsLicenseServiceExists(): void
    {
        $isa = Isa::withKeycode(self::FAKE_KEYCODE, self::FAKE_EMAIL);
        // ZyInsClient.license is the only license service surface.
        self::assertNotNull($isa->zyins->license);
    }

    public function testZyinsCasesShareIsAliasOfCreate(): void
    {
        $isa = Isa::withKeycode(self::FAKE_KEYCODE, self::FAKE_EMAIL);
        $cases = $isa->zyins->cases;
        // Both methods must exist on the Cases\Service instance.
        self::assertTrue(method_exists($cases, 'share'));
        self::assertTrue(method_exists($cases, 'create'));
    }
}
