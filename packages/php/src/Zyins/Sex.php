<?php

declare(strict_types=1);

namespace Sah\Sdk\Zyins;

/**
 * Applicant biological sex. The wire format uses single-letter codes
 * (`M`/`F`); {@see wireCode()} performs that mapping so callers never
 * spell the letter inline.
 */
enum Sex: string
{
    case Male = 'male';
    case Female = 'female';

    public function wireCode(): string
    {
        return match ($this) {
            self::Male => 'M',
            self::Female => 'F',
        };
    }
}
