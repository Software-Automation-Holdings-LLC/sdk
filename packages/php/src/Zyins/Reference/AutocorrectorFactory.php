<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Reference;

/**
 * Top-level kernel factory for the autocorrector adapter.
 *
 * Returned by {@see \Isa\Sdk\Isa::autocorrector()}. The single `create()`
 * method is the inverse of dependency-injecting an
 * {@see AutocorrectorInterface} through the {@see \Isa\Sdk\Isa}
 * constructor — `create()` builds a {@see DefaultAutocorrector} bound
 * to the supplied typo map, with no implicit bundle resolution.
 *
 * @example
 *  $typoMap = ['HBP' => 'HIGH BLOOD PRESSURE'];
 *  $ac = Isa::autocorrector()->create($typoMap);
 *  echo $ac->correct('hbp');
 */
final readonly class AutocorrectorFactory
{
    /**
     * Construct a default autocorrector around a supplied typo map.
     *
     * @param array<string,string> $typoMap   Uppercase typo → uppercase correction.
     * @param string|null          $versionTag Optional opaque tag describing the typo map.
     * @param (\Closure(AutocorrectEvent):void)|null $onApplied Optional event callback.
     */
    public function create(
        array $typoMap,
        ?string $versionTag = null,
        ?\Closure $onApplied = null,
    ): DefaultAutocorrector {
        return new DefaultAutocorrector(
            typoMap: $typoMap,
            versionTag: $versionTag,
            onApplied: $onApplied,
        );
    }
}
