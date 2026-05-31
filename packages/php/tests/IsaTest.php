<?php

declare(strict_types=1);

namespace Isa\Sdk\Tests;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use Isa\Sdk\Core\InMemoryCredentialStore;
use Isa\Sdk\Isa;
use Isa\Sdk\Zyins\Exception\IsaConfigException;
use Isa\Sdk\Zyins\Licenses\CredentialState;
use Isa\Sdk\Zyins\Licenses\LicenseRefreshedEvent;

#[CoversClass(Isa::class)]
final class IsaTest extends TestCase
{
    /** @var array<string,string|false> */
    private array $savedEnv = [];

    private const KEYS = [
        'ISA_TOKEN',
        'ISA_LICENSE_KEYCODE',
        'ISA_LICENSE_EMAIL',
        'ISA_LICENSE_DEVICE_ID',
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

    public function testFromEnvPicksBearerWhenIsaTokenSet(): void
    {
        putenv('ISA_TOKEN=isa_test_' . 'AAAAAAAAAAAAAAAAAAAA');
        $isa = Isa::fromEnv();
        self::assertNull($isa->license);
    }

    public function testFromEnvPicksLicenseWhenLicenseEnvSet(): void
    {
        putenv('ISA_LICENSE_KEYCODE=ABC-123-XYZ');
        putenv('ISA_LICENSE_EMAIL=agent@example.com');
        $isa = Isa::fromEnv();
        self::assertNotNull($isa->license);
    }

    public function testFromEnvThrowsWhenNothingSet(): void
    {
        $this->expectException(IsaConfigException::class);
        Isa::fromEnv();
    }

    public function testWithLicenseExposesFacade(): void
    {
        $isa = Isa::withLicense('ABC-123-XYZ', 'agent@example.com');
        self::assertNotNull($isa->license);
    }

    public function testWithLicenseGeneratesDeviceIdWhenMissing(): void
    {
        $store = new InMemoryCredentialStore();
        Isa::withLicense('ABC-123-XYZ', 'agent@example.com', store: $store);

        self::assertStringStartsWith('php-sdk-', (string) $store->get(CredentialState::STORE_KEY_DEVICE_ID));
    }

    public function testOnLicenseRefreshedSubscriptionFires(): void
    {
        $store = new InMemoryCredentialStore();
        $isa = Isa::withLicense('ABC-123-XYZ', 'agent@example.com', store: $store, deviceId: 'd1');
        $captured = null;
        $unsub = $isa->onLicenseRefreshed(function (LicenseRefreshedEvent $e) use (&$captured): void {
            $captured = $e;
        });
        self::assertNotNull($isa->license);
        // Drive the state directly — we don't want to hit the network from the unit suite.
        // Reflection-free path: call the credentialState via the facade's underlying state isn't exposed,
        // so we exercise the public surface by triggering refresh through CredentialState (visible to the
        // package via friend access via the Isa private member). Use a reflection workaround.
        $ref = new \ReflectionClass($isa);
        $prop = $ref->getProperty('credentialState');
        $state = $prop->getValue($isa);
        self::assertNotNull($state);
        $state->refreshLicenseKey('license-key-fresh');

        self::assertNotNull($captured);
        self::assertSame('license-key-fresh', $captured->licenseKey);
        self::assertSame('ABC-123-XYZ', $captured->orderId);
        self::assertSame('license-key-fresh', $store->get('isa.licenseKey'));

        $unsub();
    }
}
