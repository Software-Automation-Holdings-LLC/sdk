<?php

declare(strict_types=1);

namespace Sah\Sdk\Zyins;

/**
 * How long ago the applicant last used any nicotine product.
 *
 * Values mirror the server's `NicotineLastUsed` enum exactly; the SDK
 * re-exports them under a friendlier name so callers never spell raw strings.
 *
 * Use this with {@see NicotineUsageInput} as the modern replacement for
 * the deprecated {@see NicotineUsage} tri-state enum.
 */
enum NicotineDuration: string
{
    case Never            = 'never';
    case Within12Months   = 'within_12_months';
    case N12To24Months    = '12_to_24_months';
    case N24To36Months    = '24_to_36_months';
    case N36To48Months    = '36_to_48_months';
    case N48To60Months    = '48_to_60_months';
    case Over60Months     = 'over_60_months';
}
