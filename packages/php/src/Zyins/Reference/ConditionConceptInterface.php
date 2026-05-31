<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Reference;

/**
 * Marker interface returned by `conditions->match()` for a known
 * condition concept. Distinguishes condition handles from medication
 * handles at the type level so consumers can narrow without consulting
 * `kind()`.
 *
 * Unknown matches do NOT implement this — they implement
 * {@see ConceptInterface} only.
 */
interface ConditionConceptInterface extends ConceptInterface
{
}
