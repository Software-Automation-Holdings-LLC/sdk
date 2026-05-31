<?php

declare(strict_types=1);

namespace Isa\Sdk\Tests\Proxy\Support;

use Isa\Sdk\Proxy\IdempotencyKeySource;

/**
 * Deterministic idempotency key source for assertions on outbound headers.
 */
final class FixedKeySource implements IdempotencyKeySource
{
    public function __construct(private readonly string $value)
    {
    }

    public function next(): string
    {
        return $this->value;
    }
}
