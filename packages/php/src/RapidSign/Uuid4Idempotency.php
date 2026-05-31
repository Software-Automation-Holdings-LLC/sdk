<?php

declare(strict_types=1);

namespace Isa\Sdk\RapidSign;

use Ramsey\Uuid\Uuid;

/**
 * Default UUIDv4-backed idempotency source. Safe across forks and
 * threads — every call produces a fresh value from the system CSPRNG.
 */
final class Uuid4Idempotency implements Idempotency
{
    public function next(): string
    {
        return Uuid::uuid4()->toString();
    }
}
