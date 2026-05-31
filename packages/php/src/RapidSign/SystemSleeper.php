<?php

declare(strict_types=1);

namespace Isa\Sdk\RapidSign;

/** Default {@see Sleeper}: `usleep` with millisecond resolution. */
final class SystemSleeper implements Sleeper
{
    public function sleepMs(int $ms): void
    {
        if ($ms <= 0) {
            return;
        }
        usleep($ms * 1_000);
    }
}
