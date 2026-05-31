<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Reference;

/**
 * One product's v3 offer, returned identically by `POST /v3/prequalify`
 * and `POST /v3/quote`. Array order of `pricing` is authoritative for
 * display — there is no `result_index`, no client-side sort key, no
 * synthetic rank.
 *
 * `deathBenefit` is always present (`period: null` — a one-time lump
 * sum). `budget` is present only on monthly-budget quotes
 * (`period: V3Period::Monthly`, the requested budget — the stable
 * grouping key for budget responses).
 *
 * `eligible` is a convenience field — equivalent to
 * `count(array_filter($pricing, fn ($r) => $r->eligibility->eligible)) > 0`.
 */
final readonly class V3Offer
{
    /**
     * @param list<mixed> $planInfo
     * @param list<V3PricingRow> $pricing
     * @param array<string,mixed> $metadata
     */
    public function __construct(
        public string $object,
        public string $id,
        public bool $eligible,
        public V3OfferCarrier $carrier,
        public V3OfferProduct $product,
        public array $planInfo,
        public V3Money $deathBenefit,
        public array $pricing,
        public array $metadata,
        public ?V3Money $budget = null,
    ) {
    }
}
