<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Reference;

/** Carrier identity surfaced on a v3 offer. */
final readonly class V3OfferCarrier
{
    public function __construct(
        public string $id,
        public string $name,
        public string $logoUrl,
    ) {
    }
}
