<?php

declare(strict_types=1);

namespace Isa\Sdk\Tests\Account;

use Isa\Sdk\Account\CaseCrypto;
use Isa\Sdk\Account\CaseDecryptException;
use Isa\Sdk\Account\CaseEnvelope;
use Isa\Sdk\Account\CaseLink;
use Isa\Sdk\Account\CasesClient;
use Isa\Sdk\Account\EncryptedCase;
use Isa\Sdk\Account\Http;
use Isa\Sdk\Tests\Zyins\Support\MockHttpClient;
use InvalidArgumentException;
use JsonException;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;

/**
 * A stored case envelope must not decrypt when its AES-GCM tag is not 16
 * bytes. Share keeps the key in the link fragment and the ciphertext, IV,
 * and tag on the account API; open loads that envelope and decrypts it.
 * These tests fail while a shorter tag is still passed through to OpenSSL.
 */
#[CoversClass(CaseCrypto::class)]
#[CoversClass(CasesClient::class)]
final class CaseTagLengthTest extends TestCase
{
    private const string PRODUCT = 'zyins';
    private const string CASE_CODE = 'case-id';
    private const string VIEWER = 'https://link.test';
    private const string ACCOUNT = 'https://account.test';
    private const int TAG_BYTES = 16;
    private const int AES_256_KEY_BYTES = 32;
    private const int IV_BYTES = 12;

    public function testDecryptRejectsAuthenticTagTruncatedToOneByte(): void
    {
        $this->assertDecryptRejectsTruncatedTag($this->seal(['applicant' => 'kept']), 1);
    }

    public function testDecryptRejectsAuthenticTagTruncatedToFourBytes(): void
    {
        $this->assertDecryptRejectsTruncatedTag($this->seal(['applicant' => 'kept']), 4);
    }

    public function testDecryptRejectsAuthenticTagTruncatedToFifteenBytes(): void
    {
        $this->assertDecryptRejectsTruncatedTag($this->seal(['applicant' => 'kept']), 15);
    }

    public function testDecryptRejectsAes256TagTruncatedToOneByte(): void
    {
        $this->assertDecryptRejectsTruncatedTag($this->seal256(['kept' => true]), 1);
    }

    public function testOpenRejectsStoredTagTruncatedToOneByte(): void
    {
        $sealed = $this->seal(['applicant' => 'kept']);
        $this->assertOpenRejects($sealed->keyFragment, $this->truncate($sealed->envelope, 1));
    }

    public function testOpenRejectsAes256TagTruncatedToOneByte(): void
    {
        $sealed = $this->seal256(['kept' => true]);
        $this->assertOpenRejects($sealed->keyFragment, $this->truncate($sealed->envelope, 1));
    }

    public function testOpenRejectsCiphertextReplacedUnderOneByteTag(): void
    {
        $sealed = $this->seal(['applicant' => 'kept']);
        $forged = $this->forgeOneByteEnvelope($sealed);
        self::assertNotSame($sealed->envelope->ciphertext, $forged->ciphertext);
        self::assertNotSame(self::TAG_BYTES, strlen((string) base64_decode($forged->tag, true)));
        $this->assertOpenRejects($sealed->keyFragment, $forged);
    }

    private function assertDecryptRejectsTruncatedTag(EncryptedCase $sealed, int $tagBytes): void
    {
        $crypto = new CaseCrypto();
        $this->assertRejected(fn (): mixed => $crypto->decrypt(
            self::PRODUCT,
            $this->truncate($sealed->envelope, $tagBytes),
            $sealed->keyFragment,
        ));
    }

    private function assertOpenRejects(string $keyFragment, CaseEnvelope $envelope): void
    {
        $http = new MockHttpClient();
        $http->queue(200, json_encode([
            'data' => [
                'product' => self::PRODUCT,
                'ciphertext' => $envelope->ciphertext,
                'iv' => $envelope->iv,
                'tag' => $envelope->tag,
            ],
        ], JSON_THROW_ON_ERROR));
        $cases = new CasesClient(new Http($http, self::ACCOUNT));
        $link = CaseLink::assemble(self::VIEWER, self::CASE_CODE, $keyFragment);
        $this->assertRejected(fn (): mixed => $cases->open($link)->payload);
        self::assertCount(1, $http->requests);
        self::assertSame('GET', $http->requests[0]->getMethod());
        self::assertSame(
            self::ACCOUNT . '/v1/case/' . self::CASE_CODE,
            (string) $http->requests[0]->getUri(),
        );
    }

    private function assertRejected(callable $open): void
    {
        try {
            $payload = $open();
        } catch (CaseDecryptException | InvalidArgumentException) {
            return;
        }
        self::fail(
            'decryption returned a payload for a tag that is not '
            . self::TAG_BYTES . ' bytes: ' . json_encode($payload),
        );
    }

    private function seal(mixed $payload): EncryptedCase
    {
        return (new CaseCrypto())->encrypt(self::PRODUCT, $payload);
    }

    /** Older envelopes use a 256-bit key. Decrypt selects that cipher by length. */
    private function seal256(mixed $payload): EncryptedCase
    {
        $key = str_repeat("\x11", self::AES_256_KEY_BYTES);
        $iv = str_repeat("\x22", self::IV_BYTES);
        $tag = '';
        $ciphertext = openssl_encrypt(
            json_encode($payload, JSON_THROW_ON_ERROR),
            'aes-256-gcm',
            $key,
            OPENSSL_RAW_DATA,
            $iv,
            $tag,
            self::PRODUCT,
            self::TAG_BYTES,
        );
        self::assertIsString($ciphertext);
        self::assertSame(self::TAG_BYTES, strlen($tag));
        return new EncryptedCase(
            envelope: new CaseEnvelope(
                ciphertext: base64_encode($ciphertext),
                iv: base64_encode($iv),
                tag: base64_encode($tag),
            ),
            keyFragment: rtrim(strtr(base64_encode($key), '+/', '-_'), '='),
        );
    }

    private function truncate(CaseEnvelope $envelope, int $tagBytes): CaseEnvelope
    {
        $tag = base64_decode($envelope->tag, true);
        self::assertIsString($tag);
        self::assertSame(self::TAG_BYTES, strlen($tag));
        self::assertLessThan(self::TAG_BYTES, $tagBytes);
        return new CaseEnvelope(
            ciphertext: $envelope->ciphertext,
            iv: $envelope->iv,
            tag: base64_encode(substr($tag, 0, $tagBytes)),
        );
    }

    /**
     * One-byte ciphertext and tag, the guess a storage attacker can try on
     * each open. Returns the first pair OpenSSL authenticates to JSON.
     */
    private function forgeOneByteEnvelope(EncryptedCase $sealed): CaseEnvelope
    {
        $key = $this->decodeFragment($sealed->keyFragment);
        $iv = base64_decode($sealed->envelope->iv, true);
        self::assertIsString($iv);
        for ($ciphertext = 0; $ciphertext < 256; $ciphertext++) {
            $envelope = $this->matchingOneByteTag($key, $iv, chr($ciphertext), $sealed->envelope->iv);
            if ($envelope !== null) {
                return $envelope;
            }
        }
        self::fail('OpenSSL accepted no one-byte JSON plaintext under a one-byte tag');
    }

    private function matchingOneByteTag(string $key, string $iv, string $ciphertext, string $ivB64): ?CaseEnvelope
    {
        for ($tag = 0; $tag < 256; $tag++) {
            $plain = openssl_decrypt(
                $ciphertext,
                'aes-128-gcm',
                $key,
                OPENSSL_RAW_DATA,
                $iv,
                chr($tag),
                self::PRODUCT,
            );
            if (! is_string($plain) || ! $this->decodesAsJson($plain)) {
                continue;
            }
            return new CaseEnvelope(
                ciphertext: base64_encode($ciphertext),
                iv: $ivB64,
                tag: base64_encode(chr($tag)),
            );
        }
        return null;
    }

    private function decodesAsJson(string $plain): bool
    {
        try {
            json_decode($plain, true, flags: JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            return false;
        }
        return true;
    }

    private function decodeFragment(string $fragment): string
    {
        $normalized = strtr($fragment, '-_', '+/');
        $padded = str_pad($normalized, intdiv(strlen($normalized) + 3, 4) * 4, '=');
        $raw = base64_decode($padded, true);
        self::assertIsString($raw);
        return $raw;
    }
}
