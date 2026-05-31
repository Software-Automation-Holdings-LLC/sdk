<?php

declare(strict_types=1);

namespace Isa\Sdk\Tests\Proxy\Support;

use Isa\Sdk\Proxy\Clock;

/**
 * Deterministic clock for Algosure signature tests.
 */
final class FixedClock implements Clock
{
    public function __construct(private readonly int $millis)
    {
    }

    public function nowMillis(): int
    {
        return $this->millis;
    }
}
