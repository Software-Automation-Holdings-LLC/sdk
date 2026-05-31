<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Options;

use InvalidArgumentException;

/**
 * License-credential auth supplier.
 *
 * Null fields defer resolution to the legacy factory's env-var
 * fallback (ISA_LICENSE_KEYCODE / ISA_LICENSE_EMAIL).
 */
final readonly class LicenseAuth implements AuthSupplier
{
    public function __construct(
        public ?string $keycode = null,
        public ?string $email = null,
    ) {
    }

    public function kind(): string
    {
        return 'license';
    }

    /**
     * Construct from explicit keycode + email.
     */
    public static function fromKeycode(string $keycode, string $email): self
    {
        if ($keycode === '') {
            throw new InvalidArgumentException(
                'LicenseAuth::fromKeycode: keycode must be a non-empty string'
            );
        }
        if ($email === '') {
            throw new InvalidArgumentException(
                'LicenseAuth::fromKeycode: email must be a non-empty string'
            );
        }

        return new self($keycode, $email);
    }

    /**
     * Construct a deferred-resolution supplier (reads env vars at
     * factory time).
     */
    public static function fromEnv(): self
    {
        return new self(null, null);
    }
}
