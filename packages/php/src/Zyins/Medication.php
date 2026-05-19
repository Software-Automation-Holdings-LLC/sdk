<?php

declare(strict_types=1);

namespace Sah\Sdk\Zyins;

/**
 * One medication on the applicant profile. Date fields are the
 * engine's relative-date strings (e.g., "11 MONTHS AGO"); the SDK
 * does not parse them.
 */
final readonly class Medication
{
    public function __construct(
        public string $name,
        public string $use,
        public string $firstFill,
        public string $lastFill,
    ) {
    }
}
