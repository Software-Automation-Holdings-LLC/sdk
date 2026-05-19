<?php

declare(strict_types=1);

namespace Sah\Sdk\Proxy;

/**
 * Production clock — reads the system wall clock. The only direct
 * `microtime()` call in the package; every other code path receives a
 * {@see Clock} instance so tests stay deterministic.
 */
final readonly class SystemClock implements Clock
{
    public function nowMillis(): int
    {
        return (int) round(microtime(true) * 1000);
    }
}
