<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Reference;

/**
 * A monetary amount in integer minor units (US cents) paired with the
 * server-formatted display string — the OpenAPI `AmountResponse`. `cents`
 * is canonical for arithmetic and comparison; `display` is rendered
 * verbatim and never parsed.
 */
final readonly class V3Amount
{
    public function __construct(
        public int $cents,
        public string $display,
    ) {
    }
}
