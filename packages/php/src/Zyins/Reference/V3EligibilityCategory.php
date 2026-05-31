<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Reference;

/**
 * Underwriting rank bucket. NOT the carrier rate-class label — that
 * lives on {@see V3PricingRow::$rateClass}. `null` is reserved (on a
 * V3Eligibility) for the unlikely case the server cannot resolve any
 * bucket; the enum itself stays closed.
 */
enum V3EligibilityCategory: string
{
    case Immediate = 'immediate';
    case Graded = 'graded';
    case Rop = 'rop';
    case Other = 'other';
}
