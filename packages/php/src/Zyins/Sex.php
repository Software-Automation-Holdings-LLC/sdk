<?php

declare(strict_types=1);

namespace Sah\Sdk\Zyins;

/**
 * Applicant biological sex. The server accepts `male` and `female`
 * (canonical lowercase per ADR-012); the SDK emits only these canonical forms.
 */
enum Sex: string
{
    case Male   = 'male';
    case Female = 'female';

    /**
     * @deprecated The server accepts `male`/`female` directly. Use
     *             `$sex->value` instead. This method will be removed in v0.7.0.
     */
    public function wireCode(): string
    {
        return match ($this) {
            self::Male   => 'M',
            self::Female => 'F',
        };
    }
}
