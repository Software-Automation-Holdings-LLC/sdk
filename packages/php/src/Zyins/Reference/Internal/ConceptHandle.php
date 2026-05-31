<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Reference\Internal;

use Isa\Sdk\Zyins\Reference\ConceptInterface;
use Isa\Sdk\Zyins\Reference\ConceptKind;
use Isa\Sdk\Zyins\Reference\MakeKey;
use Isa\Sdk\Zyins\Reference\ReferenceIndex;
use Isa\Sdk\Zyins\Reference\Sort;

/**
 * Shared concrete behavior for every {@see ConceptInterface} handle the
 * matchers return. Subclasses ({@see KnownMedicationConcept},
 * {@see KnownConditionConcept}, {@see UnknownConcept}) layer the marker
 * interfaces and discriminator behavior on top so consumers can narrow
 * by type without consulting `kind()`.
 *
 * Accessors walk the {@see ReferenceIndex}: condition handles produce
 * medications via `medicationsByCondition`, medication handles produce
 * conditions via the reverse index. Unknown handles short-circuit to
 * empty arrays.
 *
 * @internal Consumers use {@see ConceptInterface} (or the marker
 * subinterfaces), never this base class.
 */
abstract class ConceptHandle implements ConceptInterface
{
    public function __construct(
        protected readonly ?string $id,
        protected readonly string $name,
        protected readonly string $kind,
        protected readonly bool $isKnown,
        protected readonly string $inputText,
        protected readonly ?ReferenceIndex $index,
    ) {
    }

    public function id(): ?string
    {
        return $this->id;
    }

    public function name(): string
    {
        return $this->name;
    }

    public function kind(): string
    {
        return $this->kind;
    }

    public function isKnown(): bool
    {
        return $this->isKnown;
    }

    public function inputText(): string
    {
        return $this->inputText;
    }

    public function conditions(string $sort = Sort::MOST_COMMON_FIRST): array
    {
        return [];
    }

    public function medications(string $sort = Sort::MOST_COMMON_FIRST): array
    {
        return [];
    }

    public function equals(ConceptInterface $other): bool
    {
        if ($this->kind !== $other->kind()) {
            return false;
        }
        if ($this->isKnown && $other->isKnown()) {
            return $this->id !== null && $this->id === $other->id();
        }
        if (! $this->isKnown && ! $other->isKnown()) {
            return MakeKey::normalize($this->inputText) === MakeKey::normalize($other->inputText());
        }
        return false;
    }

    /**
     * Stable sort by descending frequency. Ties preserve input order
     * (the server's display order).
     *
     * @param list<string>          $ids
     * @param callable(string):int  $frequency
     * @return list<string>
     */
    protected static function sortByFrequency(array $ids, callable $frequency): array
    {
        $indexed = [];
        foreach ($ids as $i => $id) {
            $indexed[] = ['id' => $id, 'index' => $i, 'freq' => $frequency($id)];
        }
        usort(
            $indexed,
            static function (array $a, array $b): int {
                if ($b['freq'] !== $a['freq']) {
                    return $b['freq'] <=> $a['freq'];
                }
                return $a['index'] <=> $b['index'];
            },
        );
        return array_map(static fn (array $x): string => $x['id'], $indexed);
    }

    /**
     * Stable sort by ascending display name (falls back to id when the
     * index has no name).
     *
     * @param list<string>              $ids
     * @param callable(string):?string  $nameOf
     * @return list<string>
     */
    protected static function sortByName(array $ids, callable $nameOf): array
    {
        $indexed = [];
        foreach ($ids as $i => $id) {
            $indexed[] = ['id' => $id, 'index' => $i, 'name' => $nameOf($id) ?? $id];
        }
        usort(
            $indexed,
            static function (array $a, array $b): int {
                $cmp = strcmp($a['name'], $b['name']);
                if ($cmp !== 0) {
                    return $cmp;
                }
                return $a['index'] <=> $b['index'];
            },
        );
        return array_map(static fn (array $x): string => $x['id'], $indexed);
    }

    /** @internal Factory used by matchers and the related-concept walker. */
    public static function knownMedication(ReferenceIndex $index, string $id, string $inputText): KnownMedicationConcept
    {
        $name = $index->medicationName($id) ?? $id;
        return new KnownMedicationConcept($id, $name, $inputText, $index);
    }

    /** @internal Factory used by matchers and the related-concept walker. */
    public static function knownCondition(ReferenceIndex $index, string $id, string $inputText): KnownConditionConcept
    {
        $name = $index->conditionName($id) ?? $id;
        return new KnownConditionConcept($id, $name, $inputText, $index);
    }

    /** @internal Factory used by matchers when text fails to resolve. */
    public static function unknown(string $inputText): UnknownConcept
    {
        return new UnknownConcept($inputText);
    }
}
