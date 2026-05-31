<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Reference;

/**
 * A monetary value with a recurrence period — the OpenAPI `Money`. Used
 * for `deathBenefit` (`period: null`, a one-time lump sum) and `budget`
 * (`period: V3Period::Monthly`, the requested monthly budget). `amount`
 * is the canonical {@see V3Amount}; `period` disambiguates one-time vs
 * recurring.
 */
final readonly class V3Money
{
    public function __construct(
        public V3Amount $amount,
        public ?V3Period $period,
    ) {
    }
}
