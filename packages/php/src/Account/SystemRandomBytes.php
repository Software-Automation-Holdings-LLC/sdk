<?php

declare(strict_types=1);

namespace Isa\Sdk\Account;

/**
 * Default {@see RandomBytes} backed by PHP's CSPRNG. The only place in the
 * case-crypto path that touches the OS RNG.
 */
final readonly class SystemRandomBytes implements RandomBytes
{
    public function bytes(int $length): string
    {
        if ($length < 1) {
            throw new \InvalidArgumentException('account: SystemRandomBytes requires length >= 1');
        }
        return random_bytes($length);
    }
}
