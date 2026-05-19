<?php

declare(strict_types=1);

namespace Sah\Sdk\Tests\Proxy\Support;

use Sah\Sdk\Proxy\IdempotencyKeySource;

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
