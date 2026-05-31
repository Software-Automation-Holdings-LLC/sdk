<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins;

/**
 * Detailed usage record for a single nicotine product type.
 *
 * Applicable only when {@see NicotineDuration::Within12Months} is selected.
 */
final readonly class NicotineProductUsage
{
    public function __construct(
        /**
         * Product type (e.g. 'CIGARETTE', 'CIGAR', 'PIPE', 'CHEWING TOBACCO',
         * 'NICOTINE PATCH', 'NICOTINE GUM', 'MEDICAL MARIJUANA',
         * 'RECREATIONAL MARIJUANA').
         */
        public string $type,
        /** How often the product is used. */
        public string $frequency,
    ) {}
}
