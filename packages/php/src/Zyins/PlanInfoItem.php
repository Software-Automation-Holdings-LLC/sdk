<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins;

use InvalidArgumentException;

/**
 * One server-canonical entry in a plan's `plan_info` surface.
 *
 * Mirrors the TS `OfferPlanInfoItem` interface and Python
 * `PlanInfoItem` dataclass exactly.
 *
 *  - `key` is the stable wire identifier (snake_case).
 *  - `label` is the Title Case display string (server-emitted post-#349,
 *    synthesized via {@see PlanInfoLabel::titleCase()} on legacy bodies).
 *  - `values` are the URL-decoded value strings in display order.
 *
 * Iteration is stable — the wire array order is preserved exactly.
 */
final readonly class PlanInfoItem
{
    /**
     * @param list<string> $values
     */
    public function __construct(
        public string $key,
        public string $label,
        public array $values,
    ) {
        if ($key === '') {
            throw new InvalidArgumentException(
                'PlanInfoItem: key must be a non-empty string'
            );
        }
    }
}
