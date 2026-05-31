<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Reference;

/**
 * One row of the uniform v3 pricing table — a single rate class for
 * one product. Replaces v2's `premium` + `other_offers` split: the
 * best qualifying class and every alternate (qualifying or not) are
 * sibling rows distinguished by `primary` and their own `eligibility`.
 *
 * `rateClass` is the carrier-defined label verbatim. `primary` is
 * `true` for the single best qualifying row per product. `premium` is
 * `null` when `eligibility->eligible` is `false`. `rank` is the
 * server-assigned display rank; `null` when ineligible.
 */
final readonly class V3PricingRow
{
    public function __construct(
        public string $rateClass,
        public bool $primary,
        public V3Eligibility $eligibility,
        public ?int $rank,
        public ?V3Premium $premium = null,
    ) {
    }
}
