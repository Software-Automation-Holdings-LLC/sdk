<?php

declare(strict_types=1);

namespace Sah\Sdk\Zyins;

/**
 * Deprecated three-state nicotine usage enum.
 *
 * @deprecated Use {@see NicotineUsageInput} with {@see NicotineDuration}.
 *
 * Migration:
 * - `NicotineUsage::None`    → `new NicotineUsageInput(NicotineDuration::Never)`
 * - `NicotineUsage::Current` → `new NicotineUsageInput(NicotineDuration::Within12Months)`
 * - `NicotineUsage::Former`  → `new NicotineUsageInput(NicotineDuration::N12To24Months)`
 */
enum NicotineUsage: string
{
    case None = 'none';
    case Current = 'current';
    case Former = 'former';
}
