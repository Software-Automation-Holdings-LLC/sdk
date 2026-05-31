<?php

declare(strict_types=1);

namespace Isa\Sdk\Tests\RapidSign\Support;

use Isa\Sdk\RapidSign\Idempotency;

/** Deterministic idempotency source for outbound-header assertions. */
final class FixedIdempotency implements Idempotency
{
    /** @var list<string> */
    private array $queue;

    /** @param list<string> $queue */
    public function __construct(array $queue)
    {
        $this->queue = $queue;
    }

    public function next(): string
    {
        if ($this->queue === []) {
            return '00000000-0000-4000-8000-000000000000';
        }
        return array_shift($this->queue);
    }
}
