<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Reference;

/**
 * Result of a `POST /v3/prequalify` call.
 *
 * Always a flat `plans` array (one {@see V3Offer} per product) — single
 * amount and multi-amount alike. Group client-side by the requested
 * dimension with {@see PrequalifyV3Result::byAmount()} (deathBenefit for
 * face-amount requests, budget for monthly-budget requests); the shape
 * never changes with the amount count.
 *
 * The envelope-level `requestId`, `idempotencyKey`, `livemode`, and
 * `retryAttempts` mirror the v3 response envelope so consumers can
 * correlate calls and observe retries without parsing headers.
 */
final readonly class PrequalifyV3Result
{
    /**
     * @param list<V3Offer> $plans
     */
    public function __construct(
        public array $plans,
        public string $requestId,
        public string $idempotencyKey,
        public bool $livemode,
        public int $retryAttempts,
    ) {
    }

    /**
     * Group a flat `plans` array by the requested coverage dimension.
     * When any offer carries a `budget` (a monthly-budget response) the
     * offers key off `budget->amount->cents`; otherwise off
     * `deathBenefit->amount->cents` (a face-amount response). First-
     * appearance insertion order is preserved.
     *
     * In budget mode, an offer missing `budget` is skipped (contract
     * violation) rather than falling back to deathBenefit, which would
     * mis-bucket mixed offers.
     *
     * @param list<V3Offer> $plans
     * @return array<int,list<V3Offer>>
     */
    public static function byAmount(array $plans): array
    {
        $isBudget = false;
        foreach ($plans as $offer) {
            if ($offer->budget !== null) {
                $isBudget = true;
                break;
            }
        }
        $grouped = [];
        foreach ($plans as $offer) {
            if ($isBudget) {
                if ($offer->budget === null) {
                    // In budget mode, missing budget is a contract violation; skip.
                    continue;
                }
                $dimension = $offer->budget;
            } else {
                $dimension = $offer->deathBenefit;
            }
            $grouped[$dimension->amount->cents][] = $offer;
        }
        return $grouped;
    }
}
