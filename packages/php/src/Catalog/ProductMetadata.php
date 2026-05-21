<?php

declare(strict_types=1);

namespace Sah\Sdk\Catalog;

/**
 * Generated catalog module — do not hand-edit; rerun the generator.
 *
 * Public metadata for a single product slug.
 */
final readonly class ProductMetadata
{
    /**
     * @param list<string> $stateVariations Display-name variants used for state-specific filings.
     */
    public function __construct(
        public string $slug,
        public string $displayName,
        public string $carrier,
        public string $productClass,
        public array $stateVariations,
    ) {
    }
}
