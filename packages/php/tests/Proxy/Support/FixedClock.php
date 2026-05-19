<?php

declare(strict_types=1);

namespace Sah\Sdk\Tests\Proxy\Support;

use Sah\Sdk\Proxy\Clock;

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
