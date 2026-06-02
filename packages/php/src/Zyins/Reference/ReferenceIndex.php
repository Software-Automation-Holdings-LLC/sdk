<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Reference;

/**
 * Per-dataset-version read-only index over a {@see DatasetBundleV3}.
 *
 * Built once per bundle. Derives every lookup the v3 matchers and
 * the autocomplete adapter need from the inline-row shape:
 *  - id → display name (conditions + medications)
 *  - condition id → medication ids (from `treated_with[]`)
 *  - medication id → condition ids (from `used_for[]`)
 *  - frequency: (condition id, medication id) → prescription count
 *
 * Cached via a {@see \WeakMap} keyed on the bundle instance so repeated
 * `match()` calls against the same dataset version skip the rebuild.
 *
 * @internal Consumers use {@see ConceptInterface} handles, not this class.
 */
final class ReferenceIndex
{
    /** @var array<string,string> */
    private array $conditionNames = [];

    /** @var array<string,string> */
    private array $medicationNames = [];

    /** @var array<string,string> name check-key → condition id (first-write-wins) */
    private array $conditionIdByCheckKey = [];

    /** @var array<string,string> name check-key → medication id (first-write-wins) */
    private array $medicationIdByCheckKey = [];

    /** @var array<string,list<string>> */
    private array $medsByCondition = [];

    /** @var array<string,list<string>> */
    private array $conditionsByMedication = [];

    /** @var array<string,array<string,int>> condition id → medication id → count */
    private array $frequencies = [];

    /** @var array<string,int> medication id → max condition-prescription frequency */
    private array $medicationFrequency = [];

    /** @var array<string,int> condition id → max medication-prescription frequency */
    private array $conditionFrequency = [];

    private readonly string $version;

    private function __construct(DatasetBundleV3 $bundle)
    {
        $this->version = $bundle->version;

        foreach ($bundle->conditions as $row) {
            $this->conditionNames[$row->id] = $row->name;
            $this->indexCheckKey($this->conditionIdByCheckKey, $row->name, $row->id);
            $medIds = [];
            foreach ($row->treatedWith as $rel) {
                $medIds[] = $rel->id;
                $this->frequencies[$row->id][$rel->id] = $rel->prescriptionCount;
                $this->conditionFrequency[$row->id] = max(
                    $this->conditionFrequency[$row->id] ?? 0,
                    $rel->prescriptionCount,
                );
            }
            $this->medsByCondition[$row->id] = $medIds;
        }
        foreach ($bundle->medications as $row) {
            $this->medicationNames[$row->id] = $row->name;
            $this->indexCheckKey($this->medicationIdByCheckKey, $row->name, $row->id);
            $condIds = [];
            foreach ($row->usedFor as $rel) {
                $condIds[] = $rel->id;
                if (! isset($this->frequencies[$rel->id][$row->id])) {
                    $this->frequencies[$rel->id][$row->id] = $rel->prescriptionCount;
                }
                $this->medicationFrequency[$row->id] = max(
                    $this->medicationFrequency[$row->id] ?? 0,
                    $rel->prescriptionCount,
                );
            }
            $this->conditionsByMedication[$row->id] = $condIds;
        }
    }

    /** @var \WeakMap<DatasetBundleV3,self>|null */
    private static ?\WeakMap $cache = null;

    public static function forBundle(DatasetBundleV3 $bundle): self
    {
        $cache = self::$cache;
        if ($cache === null) {
            /** @var \WeakMap<DatasetBundleV3,self> $cache */
            $cache = new \WeakMap();
            self::$cache = $cache;
        }
        $cached = $cache[$bundle] ?? null;
        if ($cached !== null) {
            return $cached;
        }
        $built = new self($bundle);
        $cache[$bundle] = $built;
        return $built;
    }

    public function datasetVersion(): string
    {
        return $this->version;
    }

    public function conditionName(string $id): ?string
    {
        return $this->conditionNames[$id] ?? null;
    }

    public function medicationName(string $id): ?string
    {
        return $this->medicationNames[$id] ?? null;
    }

    /**
     * Resolve free text to a condition id: exact id/name key first, then
     * the word-order-invariant check-key fallback. Returns null on a miss.
     * The fallback is a strict superset — it only fires when the exact key
     * missed.
     */
    public function resolveCondition(string $text): ?string
    {
        $key = MakeKey::normalize($text);
        if ($key === '') {
            return null;
        }
        if (isset($this->conditionNames[$key])) {
            return $key;
        }
        return $this->conditionIdByCheckKey[CheckKey::normalize($text)] ?? null;
    }

    /**
     * Resolve free text to a medication id: exact key first, then the
     * word-order-invariant check-key fallback. Returns null on a miss.
     */
    public function resolveMedication(string $text): ?string
    {
        $key = MakeKey::normalize($text);
        if ($key === '') {
            return null;
        }
        if (isset($this->medicationNames[$key])) {
            return $key;
        }
        return $this->medicationIdByCheckKey[CheckKey::normalize($text)] ?? null;
    }

    /**
     * Record an entity under its name's sorted check key, first-write-wins
     * so a name-multiset collision resolves to the earliest catalog entry
     * rather than letting a later row shadow it (engine-determinism parity).
     *
     * @param array<string,string> $map
     */
    private function indexCheckKey(array &$map, string $name, string $id): void
    {
        $key = CheckKey::normalize($name);
        if ($key === '' || isset($map[$key])) {
            return;
        }
        $map[$key] = $id;
    }

    /** @return list<string> */
    public function medicationsForCondition(string $conditionId): array
    {
        return $this->medsByCondition[$conditionId] ?? [];
    }

    /** @return list<string> */
    public function conditionsForMedication(string $medicationId): array
    {
        return $this->conditionsByMedication[$medicationId] ?? [];
    }

    /** @return list<string> */
    public function allConditionIds(): array
    {
        return array_keys($this->conditionNames);
    }

    /** @return list<string> */
    public function allMedicationIds(): array
    {
        return array_keys($this->medicationNames);
    }

    public function conditionFrequencyForMedication(string $medicationId, string $conditionId): int
    {
        return $this->frequencies[$conditionId][$medicationId] ?? 0;
    }

    /**
     * Cumulative-style frequency for `id` in the catalog at large —
     * used by the default autocomplete algorithm when the consumer does
     * not supply a custom `frequencies` map.
     */
    public function entityFrequency(string $id): int
    {
        return $this->medicationFrequency[$id]
            ?? $this->conditionFrequency[$id]
            ?? 0;
    }
}
