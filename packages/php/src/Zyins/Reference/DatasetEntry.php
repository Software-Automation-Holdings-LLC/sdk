<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Reference;

/**
 * One per-dataset entry: opaque version token, row count, items.
 *
 * `items` is empty in `fields=meta` responses; the SDK normalizes the
 * absence to an empty array so consumers do not branch on `null`. Item
 * shape depends on the dataset: conditions ship {@see ConditionRow},
 * medications ship {@see MedicationRow}, nicotine options ship
 * {@see NicotineOptionRow}, spelling corrections ship
 * {@see SpellingCorrectionRow}, products ship {@see ReferenceEntity}.
 */
final readonly class DatasetEntry
{
    /** @param list<ConditionRow|MedicationRow|NicotineOptionRow|SpellingCorrectionRow|ReferenceEntity> $items */
    public function __construct(
        public string $version,
        public int $itemCount,
        public array $items,
    ) {
    }
}
