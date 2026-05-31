<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Reference;

/**
 * Result of a `POST /v3/quote` call — the identical flat `plans` shape
 * as {@see PrequalifyV3Result}. Group client-side with
 * {@see PrequalifyV3Result::byAmount()} on the requested dimension
 * (deathBenefit for face amounts, budget for monthly budgets).
 */
final readonly class QuoteV3Result
{
    /** @param list<V3Offer> $plans */
    public function __construct(
        public array $plans,
        public string $requestId,
        public string $idempotencyKey,
        public bool $livemode,
        public int $retryAttempts,
    ) {
    }
}
