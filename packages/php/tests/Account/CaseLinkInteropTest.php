<?php

declare(strict_types=1);

namespace Isa\Sdk\Tests\Account;

use Isa\Sdk\Account\CaseCrypto;
use Isa\Sdk\Account\CaseDecryptException;
use Isa\Sdk\Account\CaseEnvelope;
use Isa\Sdk\Account\CaseLink;
use InvalidArgumentException;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;

/**
 * Cross-SDK case-link + case-crypto interop — PHP SDK in-process gate.
 *
 * Reads the shared fixture
 * conformance/scenarios/.fixtures/case-link-share.fixture.json (produced from
 * the canonical TypeScript WebCrypto stack) and proves:
 *
 *   - PHP assembles the byte-identical single-segment link from (base, code, key).
 *   - PHP parses both single-segment and legacy /c/ link forms to the same
 *     (code, keyFragment) every other SDK produces.
 *   - A case encrypted by TypeScript decrypts in PHP for both the 128-bit and
 *     256-bit envelopes (the "encrypted-in-X decrypts-in-all" matrix row).
 *   - PHP round-trips its own encrypt -> decrypt back to the original payload.
 *
 * Sibling tests in packages/go, packages/python, and packages/csharp read the
 * same fixture, so any divergence fails the diverging language's own CI job.
 */
#[CoversClass(CaseCrypto::class)]
#[CoversClass(CaseLink::class)]
final class CaseLinkInteropTest extends TestCase
{
    /** @return array<string,mixed> */
    private function fixture(): array
    {
        $dir = __DIR__;
        for ($i = 0; $i < 10; $i++) {
            $candidate = $dir . '/conformance/scenarios/.fixtures/case-link-share.fixture.json';
            if (file_exists($candidate)) {
                /** @var array<string,mixed> $decoded */
                $decoded = json_decode((string) file_get_contents($candidate), true, flags: JSON_THROW_ON_ERROR);
                return $decoded;
            }
            $parent = dirname($dir);
            if ($parent === $dir) {
                break;
            }
            $dir = $parent;
        }
        self::fail('case-link-share.fixture.json not found walking up from test file');
    }

    /** @param array<string,mixed> $raw */
    private function envelope(array $raw): CaseEnvelope
    {
        return new CaseEnvelope(
            ciphertext: (string) $raw['ciphertext'],
            iv: (string) $raw['iv'],
            tag: (string) $raw['tag'],
        );
    }

    public function testAssembleLinkSingleSegmentMatchesSharedFixture(): void
    {
        $fx = $this->fixture();
        $got = CaseLink::assemble(
            (string) $fx['viewer_base_url'],
            (string) $fx['code'],
            (string) $fx['key_fragment_128'],
        );
        self::assertSame($fx['expected_link_single_segment'], $got);
    }

    public function testParseLinkBothFormsMatchSharedFixture(): void
    {
        $fx = $this->fixture();
        /** @var array<int,array<string,string>> $cases */
        $cases = $fx['parse_cases'];
        foreach ($cases as $case) {
            $parsed = CaseLink::parse($case['link']);
            self::assertSame($case['expected_code'], $parsed->code);
            self::assertSame($case['expected_key_fragment'], $parsed->keyFragment);
        }
    }

    public function testParseLinkRejectsMissingFragment(): void
    {
        $this->expectException(InvalidArgumentException::class);
        CaseLink::parse('https://link.isaapi.com/abc123');
    }

    public function testDecryptTypeScriptEnvelope128(): void
    {
        $fx = $this->fixture();
        /** @var array<string,mixed> $env */
        $env = $fx['envelope_128'];
        $payload = (new CaseCrypto())->decrypt(
            (string) $fx['product'],
            $this->envelope($env),
            (string) $fx['key_fragment_128'],
        );
        self::assertSame($fx['payload'], $payload);
    }

    public function testDecryptTypeScriptEnvelope256(): void
    {
        $fx = $this->fixture();
        /** @var array<string,mixed> $env */
        $env = $fx['envelope_256'];
        $payload = (new CaseCrypto())->decrypt(
            (string) $fx['product'],
            $this->envelope($env),
            (string) $fx['key_fragment_256'],
        );
        self::assertSame($fx['payload'], $payload);
    }

    public function testDecryptWrongProductFailsAuthentication(): void
    {
        $fx = $this->fixture();
        /** @var array<string,mixed> $env */
        $env = $fx['envelope_128'];
        $this->expectException(CaseDecryptException::class);
        (new CaseCrypto())->decrypt(
            'eapp',
            $this->envelope($env),
            (string) $fx['key_fragment_128'],
        );
    }

    public function testEncryptRoundTrip(): void
    {
        $fx = $this->fixture();
        $crypto = new CaseCrypto();
        $encrypted = $crypto->encrypt((string) $fx['product'], $fx['payload']);
        $payload = $crypto->decrypt(
            (string) $fx['product'],
            $encrypted->envelope,
            $encrypted->keyFragment,
        );
        self::assertSame($fx['payload'], $payload);
    }
}
