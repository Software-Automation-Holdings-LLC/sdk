<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Reference;

/**
 * Domain-bound autocorrector stitched onto `$isa->zyins->autocorrector`.
 *
 * Lazily reads the typo map from the shared {@see ReferenceBundleCache}
 * (warmed by `$isa->zyins->datasetsV3->get()`), so consumers never
 * thread the catalog through their code. Falls back to the empty map
 * before the first dataset fetch — `correct()` becomes a no-op until
 * the bundle lands.
 *
 * Constructor injection on {@see \Isa\Sdk\Isa} replaces this default
 * with a consumer-supplied {@see AutocorrectorInterface}; this class
 * remains the canonical bundle-bound default.
 *
 * @example
 *  // After datasetsV3->get():
 *  echo $isa->zyins->autocorrector->correct('hbp');     // "HIGH BLOOD PRESSURE"
 *  echo $isa->zyins->autocorrector->correct('hbp', AutocorrectorInterface::MODE_KEYUP);
 */
final readonly class BundleBoundAutocorrector implements AutocorrectorInterface
{
    public function __construct(private ReferenceBundleCache $cache)
    {
    }

    public function correct(string $text, string $mode = AutocorrectorInterface::MODE_SUBMIT): string
    {
        $bundle = $this->cache->currentBundle();
        if ($bundle === null) {
            return $text;
        }
        // Construct a default autocorrector per call — typo maps are
        // small (<10k rows) and constructing the array is cheap.
        $defaults = new DefaultAutocorrector(typoMap: $bundle->typoMap(), versionTag: $bundle->version);
        return $defaults->correct($text, $mode);
    }
}
