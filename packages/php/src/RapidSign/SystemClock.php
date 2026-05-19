<?php

declare(strict_types=1);

namespace Sah\Sdk\RapidSign;

/** Default {@see Clock}: `microtime(true)` rounded to milliseconds. */
final class SystemClock implements Clock
{
    public function nowMs(): int
    {
        return (int) floor(microtime(true) * 1_000);
    }
}
