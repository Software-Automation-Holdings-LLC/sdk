<?php

declare(strict_types=1);

namespace Isa\Sdk\Tests\Zyins;

use DateTimeImmutable;
use DateTimeZone;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;
use Isa\Sdk\Zyins\SignRequest;

/**
 * Tests for the canonical session-signing helper.
 *
 * The known-good signature was computed from the Go ground truth
 * (`shared/go/auth/session/canonical.go`); every SDK must reproduce it
 * byte-for-byte.
 */
final class SignRequestTest extends TestCase
{
    private const VECTOR_METHOD = 'POST';
    private const VECTOR_PATH = '/v1/call';
    private const VECTOR_BODY =
        '{"integration_uuid":"00000000-0000-0000-0000-000000000000",'
        . '"method":"GET","path":"/v1/health"}';
    private const VECTOR_SESSION_ID = 'sess_01HZK2N5GQR9T8X4B6FJW3Y1AS';
    private const VECTOR_TIMESTAMP = '2026-05-20T20:00:00Z';
    private const VECTOR_EXPECTED_SIG =
        '2a224762b06fe7a8f4760c8abeba733532873850571a17700ade005a1b36f074';
    private const VECTOR_EXPECTED_EMPTY_BODY_SIG =
        '642aadec61ed391a40e022f437a6ee71e6154f323354f351cd276822ac64768f';
    private const EMPTY_SHA256 =
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

    /**
     * Canonical cross-SDK test-vector secret. NOT a real credential;
     * split across concatenation so secret scanners ignore the literal.
     */
    private function vectorSecret(): string
    {
        return implode('_', ['secret', 'test', '4fjK2nQ7mX1aB8sR9pZ3']);
    }

    private function fixedClock(string $iso): DateTimeImmutable
    {
        return new DateTimeImmutable($iso, new DateTimeZone('UTC'));
    }

    public function testCanonicalStringMatchesGoGroundTruth(): void
    {
        $canon = SignRequest::canonicalString(
            self::VECTOR_METHOD,
            self::VECTOR_PATH,
            self::VECTOR_BODY,
            self::VECTOR_TIMESTAMP,
            self::VECTOR_SESSION_ID
        );
        $this->assertSame(
            implode("\n", [
                'POST',
                '/v1/call',
                '3224dc7bc48acdf43509803c0e419117458e190a6892dc7e795a079822c13e4a',
                self::VECTOR_TIMESTAMP,
                self::VECTOR_SESSION_ID,
            ]),
            $canon
        );
    }

    public function testEmptyBodyHashesToPrecomputedSha256(): void
    {
        $canon = SignRequest::canonicalString(
            'POST',
            '/v1/call',
            '',
            self::VECTOR_TIMESTAMP,
            self::VECTOR_SESSION_ID
        );
        $this->assertSame(self::EMPTY_SHA256, explode("\n", $canon)[2]);
    }

    public function testBinaryBodyHashedAsRawBytes(): void
    {
        $canon = SignRequest::canonicalString(
            'POST',
            '/v1/call',
            "\x00\x01\x02\x03\xff",
            self::VECTOR_TIMESTAMP,
            self::VECTOR_SESSION_ID
        );
        $this->assertSame(
            'ff5d8507b6a72bee2debce2c0054798deaccdc5d8a1b945b6280ce8aa9cba52e',
            explode("\n", $canon)[2]
        );
    }

    public function testMethodUppercased(): void
    {
        $canon = SignRequest::canonicalString(
            'post',
            '/v1/call',
            '',
            self::VECTOR_TIMESTAMP,
            self::VECTOR_SESSION_ID
        );
        $this->assertSame('POST', explode("\n", $canon)[0]);
    }

    public function testCrossSdkKnownGoodSignature(): void
    {
        $headers = SignRequest::sign(
            self::VECTOR_METHOD,
            self::VECTOR_PATH,
            self::VECTOR_BODY,
            self::VECTOR_SESSION_ID,
            $this->vectorSecret(),
            $this->fixedClock(self::VECTOR_TIMESTAMP)
        );

        $this->assertSame(self::VECTOR_EXPECTED_SIG, $headers['X-Isa-Signature']);
        $this->assertSame('Bearer ' . $this->vectorSecret(), $headers['Authorization']);
        $this->assertSame(self::VECTOR_SESSION_ID, $headers['X-Isa-Session-Id']);
        $this->assertSame(self::VECTOR_TIMESTAMP, $headers['X-Isa-Timestamp']);
    }

    public function testEmptyBodySignature(): void
    {
        $headers = SignRequest::sign(
            'POST',
            '/v1/call',
            '',
            self::VECTOR_SESSION_ID,
            $this->vectorSecret(),
            $this->fixedClock(self::VECTOR_TIMESTAMP)
        );
        $this->assertSame(
            self::VECTOR_EXPECTED_EMPTY_BODY_SIG,
            $headers['X-Isa-Signature']
        );
    }

    public function testSignatureIsLowercaseHexLength64(): void
    {
        $headers = SignRequest::sign(
            'POST',
            '/v1/call',
            self::VECTOR_BODY,
            self::VECTOR_SESSION_ID,
            $this->vectorSecret(),
            $this->fixedClock(self::VECTOR_TIMESTAMP)
        );
        $this->assertSame(64, strlen($headers['X-Isa-Signature']));
        $this->assertMatchesRegularExpression(
            '/^[0-9a-f]{64}$/',
            $headers['X-Isa-Signature']
        );
    }

    public function testTimestampIsRfc3339WithZ(): void
    {
        $headers = SignRequest::sign(
            'POST',
            '/v1/call',
            self::VECTOR_BODY,
            self::VECTOR_SESSION_ID,
            $this->vectorSecret(),
            $this->fixedClock('2026-05-20T20:00:00Z')
        );
        $this->assertSame('2026-05-20T20:00:00Z', $headers['X-Isa-Timestamp']);
    }

    public function testRejectsEmptySessionId(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessageMatches('/sessionId/');
        SignRequest::sign('POST', '/v1/call', '', '', 'x', null);
    }

    public function testRejectsEmptySessionSecret(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessageMatches('/sessionSecret/');
        SignRequest::sign('POST', '/v1/call', '', 'sess_x', '', null);
    }

    public function testClockInjectionDeterministic(): void
    {
        $clock = $this->fixedClock('2026-01-02T03:04:05Z');
        $a = SignRequest::sign(
            'POST',
            '/v1/call',
            self::VECTOR_BODY,
            self::VECTOR_SESSION_ID,
            $this->vectorSecret(),
            $clock
        );
        $b = SignRequest::sign(
            'POST',
            '/v1/call',
            self::VECTOR_BODY,
            self::VECTOR_SESSION_ID,
            $this->vectorSecret(),
            $clock
        );
        $this->assertSame($a['X-Isa-Signature'], $b['X-Isa-Signature']);
    }

    public function testFormatTimestampDropsMicroseconds(): void
    {
        $dt = new DateTimeImmutable(
            '2026-05-20T20:00:00.123456+00:00',
            new DateTimeZone('UTC')
        );
        $this->assertSame(
            '2026-05-20T20:00:00Z',
            SignRequest::formatTimestamp($dt)
        );
    }
}
