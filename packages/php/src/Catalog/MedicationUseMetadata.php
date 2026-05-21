<?php

declare(strict_types=1);

namespace Sah\Sdk\Catalog;

/**
 * Public metadata for a single medication-use entry. A "use" is a
 * canonical condition name (engine wire format) that at least one
 * medication treats; `medications` lists every medication recorded
 * as treating that use.
 */
final readonly class MedicationUseMetadata
{
    /**
     * @param list<string> $medications
     */
    public function __construct(
        public string $displayName,
        public array $medications,
    ) {
    }
}
