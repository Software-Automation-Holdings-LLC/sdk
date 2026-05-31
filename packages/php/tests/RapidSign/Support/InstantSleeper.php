<?php

declare(strict_types=1);

namespace Isa\Sdk\Tests\RapidSign\Support;

use Isa\Sdk\RapidSign\Sleeper;

/**
 * No-op sleeper. Records every requested delay so tests assert on the
 * SDK's backoff math without burning wall time.
 */
final class InstantSleeper implements Sleeper
{
    /** @var list<int> */
    public array $delays = [];

    public function sleepMs(int $ms): void
    {
        $this->delays[] = $ms;
    }
}
