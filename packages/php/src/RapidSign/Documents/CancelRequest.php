<?php

declare(strict_types=1);

namespace Sah\Sdk\RapidSign\Documents;

/**
 * Cancellation inputs.
 *
 * The matching server endpoint is not yet implemented (issue #38); the
 * SDK surface lands here so the cross-language contract is final.
 */
final readonly class CancelRequest
{
    public function __construct(public string $reason)
    {
    }
}
