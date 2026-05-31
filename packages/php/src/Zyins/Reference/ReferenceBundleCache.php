<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Reference;

/**
 * Shared bundle cache for the bundleless `match()` form.
 *
 *     $isa->zyins->medications->match('lisinopril');     // no bundle arg
 *     $isa->zyins->conditions->match('hbp');             // no bundle arg
 *
 * `ZyInsClient` constructs one cache and shares it between:
 *   - the {@see Reference} facade — read path; matchers consult
 *     `currentIndex()` when no bundle is supplied;
 *   - the {@see DatasetsV3} service — write path; `get()` calls
 *     `setBundle()` on every fresh `200` response so subsequent
 *     `match()` calls observe the latest catalog.
 *
 * Before the first `datasetsV3->get()` call, `currentIndex()` returns
 * `null` and bundleless `match()` returns an unknown handle (the same
 * contract as a miss). Consumers that prefer eager-loading call
 * `$isa->zyins->datasetsV3->get()` once during boot; consumers that
 * prefer pay-as-you-go let the first `match()` return unknown until the
 * bundle lands.
 *
 * Replacing the bundle (different `version`/`etag`) invalidates the
 * built {@see ReferenceIndex}; replacing it with the same version is a
 * no-op so steady-state polling does not thrash the index.
 *
 * Safe to share across requests within one process; not safe to share
 * across processes (no serialization).
 */
final class ReferenceBundleCache
{
    private ?DatasetBundleV3 $bundle = null;
    private ?ReferenceIndex $index = null;

    /**
     * Push a freshly-fetched bundle into the cache. Idempotent for the
     * same instance; version-equivalent replacement keeps the live
     * index; a new version invalidates it (the index is rebuilt lazily
     * on the next `currentIndex()` read).
     */
    public function setBundle(DatasetBundleV3 $bundle): void
    {
        if ($this->bundle === $bundle) {
            return;
        }
        if ($this->bundle !== null && self::sameVersion($this->bundle, $bundle)) {
            // Same logical version — keep the live index; swap the
            // bundle handle so subsequent reads see the fresh entity.
            $this->bundle = $bundle;
            return;
        }
        $this->bundle = $bundle;
        $this->index = null;
    }

    /**
     * Read the active index, building it on demand. Returns `null`
     * until a bundle has been pushed via {@see setBundle()}.
     */
    public function currentIndex(): ?ReferenceIndex
    {
        if ($this->bundle === null) {
            return null;
        }
        if ($this->index === null) {
            $this->index = ReferenceIndex::forBundle($this->bundle);
        }
        return $this->index;
    }

    /**
     * Read the currently-cached bundle, if any. Exposed so Tier 3 sugar
     * (`matchMany`, `list`) on the bundleless facade can forward to the
     * existing bundle-required helpers without re-deriving state.
     */
    public function currentBundle(): ?DatasetBundleV3
    {
        return $this->bundle;
    }

    private static function sameVersion(DatasetBundleV3 $a, DatasetBundleV3 $b): bool
    {
        if ($a->etag !== null && $b->etag !== null) {
            return $a->etag === $b->etag;
        }
        return $a->version === $b->version;
    }
}
