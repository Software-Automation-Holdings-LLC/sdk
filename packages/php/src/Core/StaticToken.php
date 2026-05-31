<?php

declare(strict_types=1);

namespace Isa\Sdk\Core;

use InvalidArgumentException;

/**
 * A TokenSource that returns the same token forever.
 *
 * Suitable for short-lived CLI smoke tests. Production callers should
 * use a refreshing implementation that handles token expiry.
 */
final readonly class StaticToken implements TokenSource
{
    public function __construct(private string $value)
    {
        if ($this->value === '') {
            throw new InvalidArgumentException(
                'Isa\\Sdk\\Core\\StaticToken refuses an empty value'
            );
        }
    }

    public function token(): string
    {
        return $this->value;
    }
}
