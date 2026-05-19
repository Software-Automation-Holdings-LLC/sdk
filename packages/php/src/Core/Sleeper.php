<?php

declare(strict_types=1);

namespace Sah\Sdk\Core;

/**
 * Sleeps for the supplied duration in milliseconds.
 *
 * Tests substitute a recording sleeper that never actually waits so
 * retry-schedule assertions don't spend wall-clock time.
 */
interface Sleeper
{
    public function sleep(int $milliseconds): void;
}
