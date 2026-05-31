<?php

declare(strict_types=1);

namespace Isa\Sdk\Proxy;

/**
 * Injectable wall-clock facade. Tests substitute a fixed clock so the
 * Algosure signature derivation is deterministic; production uses
 * {@see SystemClock}.
 */
interface Clock
{
    /** Current epoch milliseconds. */
    public function nowMillis(): int;
}
