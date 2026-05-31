<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Reference;

/**
 * Eligibility for one row of the v3 pricing table.
 *
 *  - `category` is the underwriting rank bucket; `null` when unresolved.
 *  - `eligible` is `true` when the applicant qualifies at this row.
 *  - `reasons` carries the carrier-confidential reasons populated when
 *    `eligible` is `false`. Empty array when `eligible` is `true`.
 *    Per-tier specificity is intentionally not surfaced.
 */
final readonly class V3Eligibility
{
    /** @param list<string> $reasons */
    public function __construct(
        public ?V3EligibilityCategory $category,
        public bool $eligible,
        public array $reasons,
    ) {
    }
}
