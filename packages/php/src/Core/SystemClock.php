<?php

declare(strict_types=1);

namespace Sah\Sdk\Core;

/**
 * Production Clock backed by hrtime / microtime.
 */
final class SystemClock implements Clock
{
    public function nowMilliseconds(): int
    {
        return (int) floor(microtime(true) * 1000);
    }
}
