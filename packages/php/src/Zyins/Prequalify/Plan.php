<?php

declare(strict_types=1);

namespace Sah\Sdk\Zyins\Prequalify;

/**
 * One plan the prequalify engine returned. Field names match the JS
 * `PrequalifyPlan` interface (camelCase); wire-side snake_case is
 * normalized in {@see Result::fromWire()}.
 */
final readonly class Plan
{
    public function __construct(
        public string $brand,
        public string $tier,
        public float $monthlyPremium,
        public int $faceValue,
        public string $productToken,
    ) {
    }
}
