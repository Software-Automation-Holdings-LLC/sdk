<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Reference;

/**
 * One inline-row medication record from `GET /v3/datasets`.
 *
 * `usedFor` is pre-sorted descending by `prescriptionCount` (ties
 * alphabetical asc) — the SDK passes the server's order through.
 */
final readonly class MedicationRow
{
    /** @param list<Relation> $usedFor */
    public function __construct(
        public string $id,
        public string $name,
        public array $usedFor = [],
    ) {
    }
}
