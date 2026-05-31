<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Reference;

use Isa\Sdk\Zyins\Reference\Internal\ConceptHandle;

/**
 * `isa->zyins->reference->concepts` — kind-agnostic matcher.
 *
 * Tries conditions first (the typical "user typed a symptom" case),
 * then medications. Returns an unknown handle on a miss. Never throws.
 *
 * Two call shapes:
 *
 *   $isa->zyins->reference->concepts->match('hbp');           // bundleless
 *   $isa->zyins->reference->concepts->match('hbp', $bundle);  // explicit
 *
 * The bundleless form reads the cached {@see DatasetBundleV3} stitched
 * onto the matcher by {@see ZyInsClient} (warmed by `datasetsV3->get()`).
 */
final class ConceptsMatcher implements Matcher
{
    public function __construct(private readonly ?ReferenceBundleCache $cache = null)
    {
    }

    public function match(string $text, ?DatasetBundleV3 $bundle = null): ConceptInterface
    {
        $index = $this->resolveIndex($bundle);
        if ($index === null) {
            return ConceptHandle::unknown($text);
        }
        $key = MakeKey::normalize($text);
        if ($key === '') {
            return ConceptHandle::unknown($text);
        }
        if ($index->conditionName($key) !== null) {
            return ConceptHandle::knownCondition($index, $key, $text);
        }
        if ($index->medicationName($key) !== null) {
            return ConceptHandle::knownMedication($index, $key, $text);
        }
        return ConceptHandle::unknown($text);
    }

    /**
     * Match each input independently and return the resulting handles
     * in input order. Unknown inputs surface as unknown concepts (never
     * dropped), so `count($result) === count($texts)` always holds.
     *
     * @param list<string> $texts
     * @return list<ConceptInterface>
     */
    public function matchMany(array $texts, ?DatasetBundleV3 $bundle = null): array
    {
        $out = [];
        foreach ($texts as $text) {
            $out[] = $this->match($text, $bundle);
        }
        return $out;
    }

    private function resolveIndex(?DatasetBundleV3 $bundle): ?ReferenceIndex
    {
        if ($bundle !== null) {
            return ReferenceIndex::forBundle($bundle);
        }
        return $this->cache?->currentIndex();
    }
}
