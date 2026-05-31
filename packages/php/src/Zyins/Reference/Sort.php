<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Reference;

/**
 * Sort orders accepted by the {@see ConceptInterface} traversal
 * accessors.
 *
 * String constants (not an enum) to mirror the TS canonical surface
 * exactly. `MOST_COMMON_FIRST` orders by descending prescription
 * frequency from the v3 frequency graph; `ALPHABETICAL` orders by
 * display name. No asc/desc, no closures, no aliases — new sort orders
 * ship as new constants.
 */
final class Sort
{
    public const MOST_COMMON_FIRST = 'most_common_first';
    public const ALPHABETICAL = 'alphabetical';

    /** Not instantiable — pure constant carrier. */
    private function __construct()
    {
    }
}
