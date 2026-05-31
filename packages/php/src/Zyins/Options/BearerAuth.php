<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Options;

use InvalidArgumentException;

/**
 * Bearer-token auth supplier.
 *
 * Mirrors the TS `BearerAuth.fromToken(...)` / `fromEnv()` and Python
 * `BearerAuth.from_token(...)` / `from_env()` factories. A null token
 * defers resolution to the legacy factory's env-var fallback at
 * factory time (matches the TS `BearerAuth.fromEnv()` shape).
 */
final readonly class BearerAuth implements AuthSupplier
{
    public function __construct(public ?string $token = null)
    {
    }

    public function kind(): string
    {
        return 'bearer';
    }

    /**
     * Construct from an explicit token. Validates non-emptiness.
     */
    public static function fromToken(string $token): self
    {
        if ($token === '') {
            throw new InvalidArgumentException(
                'BearerAuth::fromToken: token must be a non-empty string'
            );
        }

        return new self($token);
    }

    /**
     * Construct a deferred-resolution supplier (reads ISA_TOKEN at
     * factory time).
     */
    public static function fromEnv(): self
    {
        return new self(null);
    }
}
