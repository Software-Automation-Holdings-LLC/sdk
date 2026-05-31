<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Reference;

/**
 * One inline relation on a v3 catalog row.
 *
 * Conditions carry `treated_with[]` ({@see Relation} → medication id);
 * medications carry `used_for[]` ({@see Relation} → condition id). Each
 * relation carries the foreign entity's display name and the integer
 * `prescription_count` the precompiler computed at build time.
 *
 * Pre-sorted descending by `prescriptionCount` (ties alphabetical
 * ascending) — the SDK never re-sorts.
 */
final readonly class Relation
{
    public function __construct(
        public string $id,
        public string $name,
        public int $prescriptionCount,
    ) {
    }
}
