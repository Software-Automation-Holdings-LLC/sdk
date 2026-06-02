<?php

declare(strict_types=1);

namespace Isa\Sdk\Account;

/**
 * Result of {@see CaseCrypto::encrypt()}: the wire envelope plus the base64url
 * fragment key destined for the share link's `#k=` fragment.
 */
final readonly class EncryptedCase
{
    public function __construct(
        /** The base64 fields posted to /v1/case. */
        public CaseEnvelope $envelope,
        /** The data key, base64url-encoded (no padding), for the link. */
        public string $keyFragment,
    ) {
    }
}
