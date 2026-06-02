<?php

declare(strict_types=1);

namespace Isa\Sdk\Account;

/**
 * CSPRNG facade for case-key and nonce generation, so {@see CaseCrypto} never
 * calls `random_bytes()` directly and tests can inject a deterministic source.
 */
interface RandomBytes
{
    /**
     * Return exactly `$length` cryptographically random bytes.
     */
    public function bytes(int $length): string;
}
