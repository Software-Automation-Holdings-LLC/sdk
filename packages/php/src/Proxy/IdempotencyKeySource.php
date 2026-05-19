<?php

declare(strict_types=1);

namespace Sah\Sdk\Proxy;

/**
 * Produces idempotency keys for mutating requests on the proxy API.
 *
 * The default strategy is a UUIDv4 per request — the proxy accepts any
 * unique 8–128 char ASCII token. The interface is injectable so tests
 * substitute a deterministic generator without monkey-patching globals.
 */
interface IdempotencyKeySource
{
    public function next(): string;
}
