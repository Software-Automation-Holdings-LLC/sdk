<?php

declare(strict_types=1);

namespace Sah\Sdk\Zyins;

use InvalidArgumentException;

/**
 * Applicant weight in pounds (the only unit the prequalify wire
 * accepts). The factory exists so the call site reads
 * `Weight::fromPounds(195)` rather than passing a bare number that
 * loses unit context.
 */
final readonly class Weight
{
    private function __construct(public int $pounds)
    {
    }

    public static function fromPounds(int $pounds): self
    {
        if ($pounds <= 0) {
            throw new InvalidArgumentException('Weight.fromPounds: pounds must be positive');
        }
        return new self($pounds);
    }
}
