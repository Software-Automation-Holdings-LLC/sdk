<?php

declare(strict_types=1);

namespace Sah\Sdk\Zyins;

/**
 * Structured nicotine usage state the prequalify engine consumes.
 *
 * For never-users: `new NicotineUsageInput(NicotineDuration::Never)`.
 * For current users: `new NicotineUsageInput(NicotineDuration::Within12Months, [...])`.
 *
 * Replaces the deprecated tri-state {@see NicotineUsage} enum.
 */
final readonly class NicotineUsageInput
{
    /**
     * @param NicotineProductUsage[] $productUsage
     */
    public function __construct(
        public NicotineDuration $lastUsed,
        public array $productUsage = [],
    ) {
        foreach ($this->productUsage as $usage) {
            if (! $usage instanceof NicotineProductUsage) {
                throw new \InvalidArgumentException(
                    'NicotineUsageInput.productUsage must contain NicotineProductUsage instances only'
                );
            }
        }
    }
}
