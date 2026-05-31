<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Reference;

/**
 * Premium for one row of the v3 pricing table.
 *
 *  - `cents` / `display` hold the carrier's default pricing-mode
 *    premium at the top level for backwards-compatible reads.
 *  - `default` holds the same value as a self-contained {@see V3Amount}
 *    pair — the apples-to-apples comparison value across rows.
 *  - `modes` is the full grid of carrier pricing modes
 *    (`MONTHLY-EFT`, `ANNUAL`, …) keyed by the carrier's mode token.
 *
 * Premium carries no period this release — the per-mode recurrence is a
 * documented future addition.
 */
final readonly class V3Premium
{
    /** @param array<string,V3Amount> $modes */
    public function __construct(
        public int $cents,
        public string $display,
        public V3Amount $default,
        public array $modes,
    ) {
    }
}
