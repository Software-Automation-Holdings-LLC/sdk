<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Reference\Internal;

use Isa\Sdk\Zyins\Reference\ConceptKind;
use Isa\Sdk\Zyins\Reference\ConditionConceptInterface;
use Isa\Sdk\Zyins\Reference\ReferenceIndex;
use Isa\Sdk\Zyins\Reference\Sort;

/**
 * Concrete condition concept. Implements
 * {@see ConditionConceptInterface} so consumers can narrow without
 * inspecting `kind()`. `medications()` walks the forward
 * `conditionId → medicationIds` map ordered by frequency or name.
 *
 * @internal
 */
final class KnownConditionConcept extends ConceptHandle implements ConditionConceptInterface
{
    public function __construct(string $id, string $name, string $inputText, ReferenceIndex $index)
    {
        parent::__construct(
            id: $id,
            name: $name,
            kind: ConceptKind::CONDITION,
            isKnown: true,
            inputText: $inputText,
            index: $index,
        );
    }

    public function medications(string $sort = Sort::MOST_COMMON_FIRST): array
    {
        $index = $this->index;
        if ($index === null || $this->id === null) {
            return [];
        }
        $conditionId = $this->id;
        $medIds = $index->medicationsForCondition($conditionId);
        $ordered = $sort === Sort::ALPHABETICAL
            ? self::sortByName($medIds, static fn (string $mid): ?string => $index->medicationName($mid))
            : self::sortByFrequency(
                $medIds,
                static fn (string $mid): int => $index->conditionFrequencyForMedication($mid, $conditionId),
            );
        $out = [];
        foreach ($ordered as $mid) {
            $out[] = ConceptHandle::knownMedication($index, $mid, $this->inputText);
        }
        return $out;
    }
}
