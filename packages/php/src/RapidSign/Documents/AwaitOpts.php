<?php

declare(strict_types=1);

namespace Sah\Sdk\RapidSign\Documents;

/**
 * Options for {@see Service::awaitSignature()} polling.
 *
 * `timeout` accepts ISO-8601 duration (`PT24H`), shorthand string
 * (`5m`, `2h`, `7d`), or integer milliseconds. The default budget is
 * 24 hours. PHP has no AbortSignal primitive, so callers cancel via
 * timeout alone (or a custom Sleeper that throws).
 */
final readonly class AwaitOpts
{
    public function __construct(public string|int|null $timeout = null)
    {
    }
}
