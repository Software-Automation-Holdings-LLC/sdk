<?php

declare(strict_types=1);

namespace Isa\Sdk\Account;

/**
 * The opaque crypto fields the server stores for a zero-knowledge case, all
 * standard (padded) base64. Byte-compatible with the TypeScript SDK's
 * `TCaseEnvelope` wire shape (`account/caseCrypto.ts`).
 */
final readonly class CaseEnvelope
{
    public function __construct(
        /** Std-base64 AES-GCM ciphertext with the auth tag stripped. */
        public string $ciphertext,
        /** Std-base64 AES-GCM nonce. */
        public string $iv,
        /** Std-base64 AES-GCM authentication tag. */
        public string $tag,
    ) {
    }
}
