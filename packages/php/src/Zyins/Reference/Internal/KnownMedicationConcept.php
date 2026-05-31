<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Reference\Internal;

use Isa\Sdk\Zyins\Reference\ConceptKind;
use Isa\Sdk\Zyins\Reference\MedicationConceptInterface;
use Isa\Sdk\Zyins\Reference\ReferenceIndex;
use Isa\Sdk\Zyins\Reference\Sort;

/**
 * Concrete medication concept. Implements
 * {@see MedicationConceptInterface} so consumers can narrow without
 * inspecting `kind()`. `conditions()` walks the reverse
 * `medicationId → conditionIds` index ordered by frequency or name.
 *
 * @internal
 */
final class KnownMedicationConcept extends ConceptHandle implements MedicationConceptInterface
{
    public function __construct(string $id, string $name, string $inputText, ReferenceIndex $index)
    {
        parent::__construct(
            id: $id,
            name: $name,
            kind: ConceptKind::MEDICATION,
            isKnown: true,
            inputText: $inputText,
            index: $index,
        );
    }

    public function conditions(string $sort = Sort::MOST_COMMON_FIRST): array
    {
        $index = $this->index;
        if ($index === null || $this->id === null) {
            return [];
        }
        $medId = $this->id;
        $conditionIds = $index->conditionsForMedication($medId);
        $ordered = $sort === Sort::ALPHABETICAL
            ? self::sortByName($conditionIds, static fn (string $cid): ?string => $index->conditionName($cid))
            : self::sortByFrequency(
                $conditionIds,
                static fn (string $cid): int => $index->conditionFrequencyForMedication($medId, $cid),
            );
        $out = [];
        foreach ($ordered as $cid) {
            $out[] = ConceptHandle::knownCondition($index, $cid, $this->inputText);
        }
        return $out;
    }
}
