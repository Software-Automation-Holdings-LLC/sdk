<?php

declare(strict_types=1);

namespace Isa\Sdk\Core;

/**
 * Production Sleeper backed by usleep. usleep takes microseconds, so
 * the millisecond input is scaled by MICROS_PER_MILLI before the call.
 */
final class SystemSleeper implements Sleeper
{
    private const MICROS_PER_MILLI = 1000;

    public function sleep(int $milliseconds): void
    {
        if ($milliseconds <= 0) {
            return;
        }
        usleep($milliseconds * self::MICROS_PER_MILLI);
    }
}
