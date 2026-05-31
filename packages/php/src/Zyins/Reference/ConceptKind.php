<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Reference;

/**
 * Discriminator returned by {@see ConceptInterface::kind()}.
 *
 * String constants (not an enum) to mirror the TS canonical surface
 * exactly — `kind()` returns the literal string the wire and the docs
 * use. New kinds ship as new constants; the closed list (medication,
 * condition, unknown) is stable.
 */
final class ConceptKind
{
    public const MEDICATION = 'medication';
    public const CONDITION = 'condition';
    public const UNKNOWN = 'unknown';

    /** Not instantiable — pure constant carrier. */
    private function __construct()
    {
    }
}
