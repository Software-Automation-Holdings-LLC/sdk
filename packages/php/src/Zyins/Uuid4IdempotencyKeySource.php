<?php

declare(strict_types=1);

namespace Sah\Sdk\Zyins;

use Ramsey\Uuid\Uuid;

/**
 * Default UUIDv4-backed source. Safe across forks and threads — every
 * call produces a fresh value from the system CSPRNG.
 */
final class Uuid4IdempotencyKeySource implements IdempotencyKeySource
{
    public function next(): string
    {
        return Uuid::uuid4()->toString();
    }
}
