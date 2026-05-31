<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins;

use InvalidArgumentException;

/**
 * Total applicant height, stored as a total inch count to match the
 * engine's normalized form. Construct via {@see fromFeetInches()} so
 * the call site never multiplies by 12 inline.
 */
final readonly class Height
{
    private const INCHES_PER_FOOT = 12;

    private function __construct(public int $totalInches)
    {
    }

    public static function fromFeetInches(int $feet, int $inches): self
    {
        if ($feet < 0 || $inches < 0) {
            throw new InvalidArgumentException('Height.fromFeetInches: feet and inches must be non-negative');
        }
        // Reject the silent-mistake case (e.g. fromFeetInches(5, 22) when
        // the caller meant fromInches(22)). Callers who genuinely have a
        // total-inch count should use fromInches() instead.
        if ($inches >= self::INCHES_PER_FOOT) {
            throw new InvalidArgumentException('Height.fromFeetInches: inches must be in 0..11; use fromInches() for total-inch input');
        }
        return new self($feet * self::INCHES_PER_FOOT + $inches);
    }

    public static function fromInches(int $totalInches): self
    {
        if ($totalInches < 0) {
            throw new InvalidArgumentException('Height.fromInches: totalInches must be non-negative');
        }
        return new self($totalInches);
    }
}
