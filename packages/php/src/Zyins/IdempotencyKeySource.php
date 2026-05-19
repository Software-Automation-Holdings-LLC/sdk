<?php

declare(strict_types=1);

namespace Sah\Sdk\Zyins;

/**
 * Produces idempotency keys for mutating requests.
 *
 * The default strategy is a UUIDv4 per request — the ZyINS API treats
 * any unique 8–128 char ASCII token as a valid key, and v4 is the
 * lowest-coordination choice in PHP. The interface is injectable so
 * tests substitute a deterministic generator without monkey-patching
 * `uniqid` or globals.
 */
interface IdempotencyKeySource
{
    public function next(): string;
}
