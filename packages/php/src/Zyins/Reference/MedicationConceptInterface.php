<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Reference;

/**
 * Marker interface returned by `medications->match()` for a known
 * medication concept. Distinguishes medication handles from condition
 * handles at the type level so consumers can narrow without consulting
 * `kind()`.
 *
 * Unknown matches do NOT implement this — they implement
 * {@see ConceptInterface} only.
 */
interface MedicationConceptInterface extends ConceptInterface
{
}
