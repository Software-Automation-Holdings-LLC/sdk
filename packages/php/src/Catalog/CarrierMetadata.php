<?php

declare(strict_types=1);

namespace Isa\Sdk\Catalog;

/**
 * Generated catalog module — do not hand-edit; rerun the generator.
 *
 * Public metadata for a single carrier.
 */
final readonly class CarrierMetadata
{
    /**
     * @param list<string> $products List of product slugs filed by this carrier.
     */
    public function __construct(
        public string $slug,
        public string $displayName,
        public array $products,
    ) {
    }
}
