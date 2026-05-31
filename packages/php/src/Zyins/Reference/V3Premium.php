<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Reference;

/**
 * Premium for one row of the v3 pricing table.
 *
 *  - `amount` is the headline value clients compare across carriers, as a
 *    self-contained {@see V3Amount} pair. It is byte-identical to
 *    `modes[defaultMode]`.
 *  - `defaultMode` names which `modes` entry `amount` was drawn from — the
 *    carrier mode token (`MONTHLY-EFT`, `ANNUAL`, …), which itself encodes
 *    the recurrence, so premium carries no `period` field.
 *  - `modes` is the full grid of carrier pricing modes keyed by the
 *    carrier's mode token.
 */
final readonly class V3Premium
{
    /** @param array<string,V3Amount> $modes */
    public function __construct(
        public V3Amount $amount,
        public string $defaultMode,
        public array $modes,
    ) {
    }
}
