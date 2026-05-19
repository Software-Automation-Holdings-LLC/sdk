<?php

declare(strict_types=1);

namespace Sah\Sdk\Core;

/**
 * Returns the current instant.
 *
 * Tests pin the clock to a frozen time so HTTP-date Retry-After
 * arithmetic is deterministic; production callers pass SystemClock.
 */
interface Clock
{
    public function nowMilliseconds(): int;
}
