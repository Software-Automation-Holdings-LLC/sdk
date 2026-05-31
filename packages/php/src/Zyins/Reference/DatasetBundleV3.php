<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Reference;

/**
 * The v3 reference catalog — inline-row records returned by
 * `DatasetsV3::get()` and consumed by every matcher / autocomplete /
 * autocorrector adapter in the SDK.
 *
 * Every row is self-contained: condition rows carry their treating
 * medications inline ({@see ConditionRow::$treatedWith}); medication
 * rows carry the conditions they're used for inline
 * ({@see MedicationRow::$usedFor}); each {@see Relation} ships its own
 * `prescriptionCount`. Pre-sorted server-side; the SDK never re-sorts.
 *
 * Differences from rc.1:
 *  - Response-root `medicationsByCondition` and `frequencyGraphs` maps
 *    are GONE. Single source of truth on the row.
 *  - New `spellingCorrections` dataset surfaces the typo map for the
 *    {@see DefaultAutocorrector} — feed it via {@see self::typoMap()}.
 */
final readonly class DatasetBundleV3
{
    /**
     * @param list<MedicationRow>                 $medications
     * @param list<ConditionRow>                  $conditions
     * @param list<ReferenceEntity>               $products
     * @param list<NicotineOptionRow>             $nicotineOptions
     * @param list<SpellingCorrectionRow>         $spellingCorrections
     * @param array<string,DatasetEntry>          $datasets
     * @param array<string,list<ReferenceEntity>> $productsByFamily     Product slice keyed by family slug.
     * @param array<string,int>                   $discontinuedProducts Product slug → unix epoch second discontinued.
     * @param list<string>                        $stateDerivatives     State slugs deriving from another state's ruleset.
     */
    public function __construct(
        public string $version,
        public array $medications,
        public array $conditions,
        public array $products,
        public array $nicotineOptions,
        public array $spellingCorrections,
        public array $datasets,
        /** Response ETag for conditional revalidation. */
        public ?string $etag = null,
        public array $productsByFamily = [],
        public array $discontinuedProducts = [],
        public array $stateDerivatives = [],
    ) {
    }

    /**
     * Build the typo map shape that {@see DefaultAutocorrector} expects:
     * `from` (uppercase) → `to` (uppercase). Both fields are already
     * uppercase on the wire; this is a thin reshape, not a normalization.
     *
     * @return array<string,string>
     */
    public function typoMap(): array
    {
        $out = [];
        foreach ($this->spellingCorrections as $row) {
            $out[$row->from] = $row->to;
        }
        return $out;
    }
}
