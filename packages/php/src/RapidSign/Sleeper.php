<?php

declare(strict_types=1);

namespace Sah\Sdk\RapidSign;

/**
 * Sleep facade. Test doubles substitute an instant-return implementation
 * so polling loops finish without burning real seconds.
 */
interface Sleeper
{
    public function sleepMs(int $ms): void;
}
