<?php

declare(strict_types=1);

namespace Isa\Sdk\Account;

use InvalidArgumentException;
use JsonException;

/**
 * Zero-knowledge case crypto envelope, byte-compatible with the TypeScript
 * SDK's `account/caseCrypto.ts`. The platform stores opaque ciphertext and
 * never holds a key: the SDK generates a fresh data key per case, encrypts
 * the payload with AES-GCM (the cleartext `product` tag is bound as additional
 * authenticated data), and carries the key only in the share-link `#k=`
 * fragment.
 *
 * PHP's `openssl_encrypt` returns the ciphertext and writes the auth tag to a
 * by-reference out-parameter, so the tag is already separate — matching the
 * wire contract's split `ciphertext` / `iv` / `tag` fields directly.
 *
 * HARD RULE — never log the fragment key. The key is the capability; leakage
 * defeats the zero-knowledge guarantee.
 */
final readonly class CaseCrypto
{
    /**
     * AES-128 data-key length in bytes for fresh case keys. Decrypt is
     * length-agnostic, so 256-bit keys from earlier envelopes still open;
     * this governs generation only.
     */
    private const int KEY_BYTES = 16;
    /** AES-GCM nonce length in bytes (96-bit, the GCM-recommended size). */
    private const int IV_BYTES = 12;
    /** AES-GCM authentication-tag length in bytes (128-bit). */
    private const int TAG_BYTES = 16;
    private const int AES_128_KEY_BYTES = 16;
    private const int AES_256_KEY_BYTES = 32;
    private const string CIPHER_128 = 'aes-128-gcm';
    private const string CIPHER_256 = 'aes-256-gcm';

    public function __construct(private RandomBytes $random = new SystemRandomBytes())
    {
    }

    /**
     * Encrypt a JSON-encodable payload under a fresh 128-bit key, binding
     * `$product` as AEAD additional data. Returns the base64 wire envelope and
     * the base64url fragment key.
     */
    public function encrypt(string $product, mixed $payload): EncryptedCase
    {
        $rawKey = $this->random->bytes(self::KEY_BYTES);
        $iv = $this->random->bytes(self::IV_BYTES);
        try {
            $serialized = json_encode($payload, JSON_THROW_ON_ERROR);
        } catch (JsonException $e) {
            throw new InvalidArgumentException(
                'account: CaseCrypto::encrypt payload must be JSON-serializable: ' . $e->getMessage(),
                previous: $e,
            );
        }
        $tag = '';
        $ciphertext = openssl_encrypt(
            $serialized,
            self::cipherForKey($rawKey),
            $rawKey,
            OPENSSL_RAW_DATA,
            $iv,
            $tag,
            $product,
            self::TAG_BYTES,
        );
        if ($ciphertext === false || ! is_string($tag)) {
            throw new \RuntimeException('account: CaseCrypto::encrypt AES-GCM seal failed');
        }
        return new EncryptedCase(
            envelope: new CaseEnvelope(
                ciphertext: base64_encode($ciphertext),
                iv: base64_encode($iv),
                tag: base64_encode($tag),
            ),
            keyFragment: self::bytesToBase64Url($rawKey),
        );
    }

    /**
     * Decrypt a wire envelope with the fragment key, verifying the `$product`
     * AEAD binding, and return the parsed JSON payload. Throws
     * {@see CaseDecryptException} on any authentication failure.
     */
    public function decrypt(string $product, CaseEnvelope $envelope, string $keyFragment): mixed
    {
        $rawKey = self::decodeFragmentKey($keyFragment);
        $iv = self::b64Decode($envelope->iv, 'iv');
        $ciphertext = self::b64Decode($envelope->ciphertext, 'ciphertext');
        $tag = self::b64Decode($envelope->tag, 'tag');
        $plaintext = openssl_decrypt(
            $ciphertext,
            self::cipherForKey($rawKey),
            $rawKey,
            OPENSSL_RAW_DATA,
            $iv,
            $tag,
            $product,
        );
        if ($plaintext === false) {
            throw new CaseDecryptException(
                "account: case envelope failed authentication for product {$product}: "
                . 'wrong key, wrong product, or tampered ciphertext',
            );
        }
        try {
            /** @var mixed $decoded */
            $decoded = json_decode($plaintext, associative: true, flags: JSON_THROW_ON_ERROR);
        } catch (JsonException $e) {
            throw new CaseDecryptException(
                'account: CaseCrypto::decrypt plaintext was not valid JSON: ' . $e->getMessage(),
                previous: $e,
            );
        }
        return $decoded;
    }

    /** Select the GCM cipher by key length (AES-128 vs AES-256). */
    private static function cipherForKey(string $rawKey): string
    {
        return match (strlen($rawKey)) {
            self::AES_128_KEY_BYTES => self::CIPHER_128,
            self::AES_256_KEY_BYTES => self::CIPHER_256,
            default => throw new InvalidArgumentException(
                'account: CaseCrypto unsupported key length ' . strlen($rawKey)
                . ' bytes (want 16 or 32)',
            ),
        };
    }

    private static function bytesToBase64Url(string $bytes): string
    {
        return rtrim(strtr(base64_encode($bytes), '+/', '-_'), '=');
    }

    /**
     * Decode a fragment key. Accepts the base64url share-link form (with or
     * without padding) and standard base64, mirroring the TS decoder that
     * normalizes the URL-safe alphabet before decoding.
     */
    private static function decodeFragmentKey(string $fragment): string
    {
        $normalized = strtr($fragment, '-_', '+/');
        $padded = str_pad($normalized, intdiv(strlen($normalized) + 3, 4) * 4, '=');
        $raw = base64_decode($padded, strict: true);
        if ($raw === false) {
            throw new InvalidArgumentException('account: CaseCrypto fragment key is not valid base64');
        }
        return $raw;
    }

    private static function b64Decode(string $value, string $field): string
    {
        $raw = base64_decode($value, strict: true);
        if ($raw === false) {
            throw new InvalidArgumentException("account: CaseCrypto envelope {$field} is not valid base64");
        }
        return $raw;
    }
}
