<?php

declare(strict_types=1);

namespace Isa\Sdk\RapidSign;

/**
 * Monotonic-ish wall clock in milliseconds since the epoch.
 *
 * Injectable so polling-loop tests can pin time. The system
 * implementation defers to `microtime(true)`; production code never
 * imports it directly — it asks for a `Clock`.
 */
interface Clock
{
    public function nowMs(): int;
}
