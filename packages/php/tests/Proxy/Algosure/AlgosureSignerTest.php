<?php

declare(strict_types=1);

namespace Isa\Sdk\Tests\Proxy\Algosure;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use Isa\Sdk\Proxy\Algosure\AlgosureInput;
use Isa\Sdk\Proxy\Algosure\AlgosureSigner;
use Isa\Sdk\Proxy\Exception\AlgosureException;
use Isa\Sdk\Tests\Proxy\Support\FixedClock;

#[CoversClass(AlgosureSigner::class)]
final class AlgosureSignerTest extends TestCase
{
    public function testBuildHeadersEmitsExpectedHeaderSet(): void
    {
        $signer = new AlgosureSigner(clock: new FixedClock(1714000000000));
        $headers = $signer->buildHeaders(new AlgosureInput(
            host: 'https://example.test',
            method: 'POST',
            path: '/v1/call',
            salt: 'abcdefghijklmnop',
            saltId: 42,
            sessionId: 'sess_abc',
            body: ['x' => 1],
        ));
        $this->assertSame('https://example.test', $headers['*Host']);
        $this->assertSame('1714000000000', $headers['*Timestamp']);
        $this->assertSame('sess_abc', $headers['*sessionId']);
        $this->assertSame('42', $headers['*SaltId']);
        $this->assertNotEmpty($headers['Authorization']);
        $this->assertMatchesRegularExpression('/^[0-9a-f]{64}$/', $headers['Authorization']);
    }

    public function testComputeHmacRejectsInvalidSaltId(): void
    {
        $signer = new AlgosureSigner(clock: new FixedClock(1));
        $this->expectException(AlgosureException::class);
        $signer->computeHmac(new AlgosureInput(
            host: 'h',
            method: 'POST',
            path: '/',
            salt: 'abcdefgh',
            saltId: 0,
            sessionId: 's',
        ));
    }

    public function testEmptySaltRaisesAlgosureException(): void
    {
        $signer = new AlgosureSigner(clock: new FixedClock(1));
        $this->expectException(AlgosureException::class);
        $signer->buildHeaders(new AlgosureInput(
            host: 'h',
            method: 'POST',
            path: '/',
            salt: '',
            saltId: 1,
            sessionId: 's',
        ));
    }

    public function testInvalidSaltIdRaisesAlgosureException(): void
    {
        $signer = new AlgosureSigner(clock: new FixedClock(1));
        $this->expectException(AlgosureException::class);
        $signer->buildHeaders(new AlgosureInput(
            host: 'h',
            method: 'POST',
            path: '/',
            salt: 'abcdefgh',
            saltId: 0,
            sessionId: 's',
        ));
    }

    public function testNonSerializableBodyRaisesAlgosureException(): void
    {
        $circular = new \stdClass();
        $circular->self = $circular;
        $signer = new AlgosureSigner(clock: new FixedClock(1));
        $this->expectException(AlgosureException::class);
        $signer->buildHeaders(new AlgosureInput(
            host: 'h',
            method: 'POST',
            path: '/',
            salt: 'abcdefgh',
            saltId: 1,
            sessionId: 's',
            body: $circular,
        ));
    }

    public function testIsSaltIdValidAcceptsCanonicalForms(): void
    {
        $this->assertTrue(AlgosureSigner::isSaltIdValid(1));
        $this->assertTrue(AlgosureSigner::isSaltIdValid('42'));
        $this->assertFalse(AlgosureSigner::isSaltIdValid(0));
        $this->assertFalse(AlgosureSigner::isSaltIdValid(-3));
        $this->assertFalse(AlgosureSigner::isSaltIdValid(''));
        $this->assertFalse(AlgosureSigner::isSaltIdValid('042'));
        $this->assertFalse(AlgosureSigner::isSaltIdValid('abc'));
    }

    public function testDeriveSimpleKeyReturnsAtLeastEightBytes(): void
    {
        $key = AlgosureSigner::deriveSimpleKey('abcdefghij', 0);
        $this->assertGreaterThanOrEqual(8, strlen($key));
    }
}
