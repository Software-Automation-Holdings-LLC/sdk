<?php

declare(strict_types=1);

namespace Isa\Sdk\Tests\RapidSign\Support;

use Isa\Sdk\RapidSign\Clock;

/**
 * Manually-advanced clock. Polling-loop tests pin `nowMs()` to control
 * deadlines without burning real seconds.
 */
final class FixedClock implements Clock
{
    public function __construct(private int $current = 0)
    {
    }

    public function nowMs(): int
    {
        return $this->current;
    }

    public function advance(int $ms): void
    {
        $this->current += $ms;
    }
}
