<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Reference;

/**
 * Recurrence period for a {@see V3Money}. `null` (the absence of this
 * enum) is a one-time / lump-sum amount — a death benefit. The cases are
 * premium billing cycles.
 */
enum V3Period: string
{
    case Monthly = 'monthly';
    case Quarterly = 'quarterly';
    case Semiannual = 'semiannual';
    case Annual = 'annual';
}
