<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins;

/**
 * One medical condition on the applicant profile. Date fields are
 * the engine's relative-date strings (e.g., "3 DAYS AGO"); the SDK
 * does not parse them.
 */
final readonly class Condition
{
    public function __construct(
        public string $name,
        public string $wasDiagnosed,
        public string $lastTreatment,
    ) {
    }
}
