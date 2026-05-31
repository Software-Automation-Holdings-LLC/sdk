<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Reference;

/**
 * Product identity surfaced on a v3 offer.
 *
 * `wireToken` is the engine's canonical product token (the same value
 * accepted by the `products[]` request field). `slug` and
 * `displayName` are UI affordances.
 */
final readonly class V3OfferProduct
{
    public function __construct(
        public string $id,
        public string $slug,
        public string $name,
        public string $displayName,
        public string $type,
        public string $wireToken,
    ) {
    }
}
