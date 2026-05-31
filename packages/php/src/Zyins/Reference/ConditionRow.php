<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Reference;

/**
 * One inline-row condition record from `GET /v3/datasets`.
 *
 * `treatedWith` is pre-sorted descending by `prescriptionCount` (ties
 * alphabetical asc) — the SDK passes the server's order through.
 */
final readonly class ConditionRow
{
    /** @param list<Relation> $treatedWith */
    public function __construct(
        public string $id,
        public string $name,
        public array $treatedWith = [],
    ) {
    }
}
