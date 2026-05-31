<?php

declare(strict_types=1);

namespace Isa\Sdk\Catalog;

/**
 * Generated catalog module — do not hand-edit; rerun the generator.
 *
 * Public metadata for a single {@see State}.
 */
final readonly class StateMetadata
{
    public function __construct(
        public string $abbreviation,
        public string $name,
        public bool $isTerritory,
    ) {
    }
}
