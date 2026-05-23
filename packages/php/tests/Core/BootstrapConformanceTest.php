<?php

declare(strict_types=1);

namespace Sah\Sdk\Tests\Core;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Sah\Sdk\Core\Bootstrap;
use Sah\Sdk\Core\BootstrapSignature;

/**
 * Bytewise conformance gate for the embedded HMAC bootstrap signature.
 *
 * The fixture at tests/conformance/fixtures/auth-vector.json (repo root)
 * is the binding contract. This PHP SDK MUST reproduce the identical hex
 * against the same inputs as the TypeScript, Go, Python, and C# SDKs.
 *
 * If this test fails after an intentional change to the auth wire format,
 * regenerate the fixture, update api/guides/authentication-advanced.md,
 * and bump every SDK's major version — the change is breaking.
 *
 */
#[CoversClass(Bootstrap::class)]
#[CoversClass(BootstrapSignature::class)]
final class BootstrapConformanceTest extends TestCase
{
    /** @var array{
     *     inputs: array{keycode:string,email:string,licenseKey:string,deviceId:string,method:string,path:string,timestamp:int},
     *     serializedBody: string,
     *     canonical: string,
     *     expected: array{algorithm:string,hex:string,header:string},
     * }
     */
    private static array $fixture;

    public static function setUpBeforeClass(): void
    {
        // packages/php/tests/Core → repo root is four levels up.
        $path = __DIR__ . '/../../../../tests/conformance/fixtures/auth-vector.json';
        $raw = file_get_contents($path);
        self::assertNotFalse($raw, "could not read auth-vector fixture at {$path}");
        /** @var array $decoded */
        $decoded = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
        /** @phpstan-ignore-next-line — fixture shape is statically known but PHPStan cannot prove it. */
        self::$fixture = $decoded;
    }

    public function testSerializedBodyMatchesFixture(): void
    {
        $sig = self::buildFromFixture();
        $this->assertSame(self::$fixture['serializedBody'], $sig->serializedBody);
    }

    public function testCanonicalMatchesFixture(): void
    {
        $sig = self::buildFromFixture();
        $this->assertSame(self::$fixture['canonical'], $sig->canonical);
    }

    public function testHexMatchesFixtureBytewise(): void
    {
        $sig = self::buildFromFixture();
        $this->assertSame(self::$fixture['expected']['hex'], $sig->hex);
    }

    public function testHeaderMatchesFixture(): void
    {
        $sig = self::buildFromFixture();
        $this->assertSame(self::$fixture['expected']['header'], $sig->header);
    }

    public function testDeviceIdOnlyAppearsInsideTheBody(): void
    {
        // Anti-regression: an earlier draft included deviceId in the
        // canonical path. Locked spec sends it as X-Device-ID header
        // only; the only canonical appearance is inside the body JSON.
        $canonical = self::$fixture['canonical'];
        $serializedBody = self::$fixture['serializedBody'];
        $deviceId = self::$fixture['inputs']['deviceId'];
        $bodyStart = strpos($canonical, $serializedBody);
        $this->assertNotFalse($bodyStart, 'fixture canonical does not contain serializedBody');
        $before = substr($canonical, 0, $bodyStart);
        $this->assertStringNotContainsString($deviceId, $before);
    }

    /**
     * @return array<string, array{string, mixed}>
     */
    public static function emptyFieldProvider(): array
    {
        return [
            'keycode'    => ['keycode',    ''],
            'email'      => ['email',      ''],
            'licenseKey' => ['licenseKey', ''],
            'deviceId'   => ['deviceId',   ''],
            'method'     => ['method',     ''],
            'path'       => ['path',       ''],
            'timestamp'  => ['timestamp',   0],
            'negative timestamp' => ['timestamp', -1],
        ];
    }

    #[DataProvider('emptyFieldProvider')]
    public function testRequiredFieldsRejectEmpty(string $field, mixed $emptyValue): void
    {
        $inputs = self::$fixture['inputs'];
        $inputs[$field] = $emptyValue;
        $this->expectException(\InvalidArgumentException::class);
        Bootstrap::build(
            keycode: (string) $inputs['keycode'],
            email: (string) $inputs['email'],
            licenseKey: (string) $inputs['licenseKey'],
            deviceId: (string) $inputs['deviceId'],
            method: (string) $inputs['method'],
            path: (string) $inputs['path'],
            timestamp: (int) $inputs['timestamp'],
        );
    }

    private static function buildFromFixture(): \Sah\Sdk\Core\BootstrapSignature
    {
        $inputs = self::$fixture['inputs'];
        return Bootstrap::build(
            keycode: $inputs['keycode'],
            email: $inputs['email'],
            licenseKey: $inputs['licenseKey'],
            deviceId: $inputs['deviceId'],
            method: $inputs['method'],
            path: $inputs['path'],
            timestamp: $inputs['timestamp'],
        );
    }
}
