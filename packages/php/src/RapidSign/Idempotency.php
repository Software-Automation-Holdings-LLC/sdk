<?php

declare(strict_types=1);

namespace Isa\Sdk\RapidSign;

/**
 * Produces idempotency keys + correlation UUIDs for the RapidSign client.
 *
 * The default strategy is UUIDv4 per call — the API accepts any unique
 * 8–128 char ASCII token as an Idempotency-Key. Injectable so tests can
 * pin a deterministic source without monkey-patching `uniqid` or globals.
 */
interface Idempotency
{
    public function next(): string;
}
