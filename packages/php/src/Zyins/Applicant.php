<?php

declare(strict_types=1);

namespace Sah\Sdk\Zyins;

use InvalidArgumentException;

/**
 * Applicant profile prequalify operates on.
 *
 * Field names mirror the JS `Applicant` interface (camelCase). The
 * wire serialization (snake_case, single-letter sex code, integer
 * inches/pounds) is the prequalify request's responsibility — value
 * objects stay in the domain language.
 *
 * Sex / NicotineUsage live here as nested string-backed enums to avoid
 * top-level namespace sprawl; PHP 8.2 enum-as-property is fully
 * readonly-compatible.
 */
final readonly class Applicant
{
    /**
     * @param Medication[] $medications
     * @param Condition[]  $conditions
     */
    public function __construct(
        public string $dob,
        public Sex $sex,
        public Height $height,
        public Weight $weight,
        public string $state,
        public NicotineUsage $nicotineUse,
        public ?string $zip = null,
        public array $medications = [],
        public array $conditions = [],
    ) {
        if ($this->dob === '') {
            throw new InvalidArgumentException('Applicant.dob must be a non-empty ISO date string');
        }
        if (strlen($this->state) !== 2) {
            throw new InvalidArgumentException('Applicant.state must be a two-letter US postal code');
        }
        foreach ($this->medications as $medication) {
            if (! $medication instanceof Medication) {
                throw new \TypeError('Applicant.medications must contain Medication instances only');
            }
        }
        foreach ($this->conditions as $condition) {
            if (! $condition instanceof Condition) {
                throw new \TypeError('Applicant.conditions must contain Condition instances only');
            }
        }
    }
}
