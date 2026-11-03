<?php

declare(strict_types=1);

namespace Isa\Sdk\Tests\Core;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use DateTimeImmutable;
use DateTimeZone;
use Isa\Sdk\Zyins\SignRequest;

/**
 * Bytewise conformance gate for the steady-state session-HMAC signature.
 *
 * The fixture at tests/conformance/fixtures/session-vector.json (repo
 * root) is the binding contract. This PHP SDK MUST reproduce the
 * identical canonical string, signature, and Authorization header as
 * the TypeScript, Go, Python, and C# SDKs.
 *
 * This is exactly the drift that shipped in all five SDKs: hard-coding
 * `Bearer <secret>` instead of `Session <secret>`. This gate turns
 * that class of bug into a CI failure.
 *
 * If this test fails after an intentional change to the session wire
 * format, regenerate the fixture (see its $comment for the
 * regeneration recipe), update
 * shared/go/auth/session/canonical.go's doc comment if the shape
 * changed, and bump every SDK's major version — the change is
 * breaking.
 */
#[CoversClass(SignRequest::class)]
final class SessionVectorConformanceTest extends TestCase
{
    /** @var array{
     *     inputs: array{sessionId:string,sessionSecret:string,method:string,path:string,body:string,timestamp:string},
     *     canonical: string,
     *     expected: array{algorithm:string,signature:string,header:string},
     * }
     */
    private static array $fixture;

    public static function setUpBeforeClass(): void
    {
        // packages/php/tests/Core → repo root is four levels up.
        $path = __DIR__ . '/../../../../tests/conformance/fixtures/session-vector.json';
        $raw = file_get_contents($path);
        self::assertNotFalse($raw, "could not read session-vector fixture at {$path}");
        /** @var array $decoded */
        $decoded = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
        /** @phpstan-ignore-next-line — fixture shape is statically known but PHPStan cannot prove it. */
        self::$fixture = $decoded;
    }

    public function testCanonicalStringMatchesFixture(): void
    {
        $inputs = self::$fixture['inputs'];
        $canonical = SignRequest::canonicalString(
            $inputs['method'],
            $inputs['path'],
            $inputs['body'],
            $inputs['timestamp'],
            $inputs['sessionId'],
        );
        $this->assertSame(self::$fixture['canonical'], $canonical);
    }

    public function testSignatureMatchesFixtureBytewise(): void
    {
        $headers = self::signFromFixture();
        $this->assertSame(self::$fixture['expected']['signature'], $headers['X-Isa-Signature']);
    }

    public function testAuthorizationHeaderUsesSessionSchemeNotBearer(): void
    {
        $headers = self::signFromFixture();
        $this->assertSame(self::$fixture['expected']['header'], $headers['Authorization']);
        $this->assertStringStartsNotWith('Bearer ', $headers['Authorization']);
    }

    /**
     * @return array{Authorization:string,'X-Isa-Session-Id':string,'X-Isa-Timestamp':string,'X-Isa-Signature':string}
     */
    private static function signFromFixture(): array
    {
        $inputs = self::$fixture['inputs'];
        $timestamp = DateTimeImmutable::createFromFormat(
            'Y-m-d\TH:i:s\Z',
            $inputs['timestamp'],
            new DateTimeZone('UTC'),
        );
        self::assertNotFalse($timestamp, 'could not parse fixture timestamp');

        return SignRequest::sign(
            $inputs['method'],
            $inputs['path'],
            $inputs['body'],
            $inputs['sessionId'],
            $inputs['sessionSecret'],
            $timestamp,
        );
    }
}
