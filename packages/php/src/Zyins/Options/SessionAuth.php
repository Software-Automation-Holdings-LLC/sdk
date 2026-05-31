<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Options;

use InvalidArgumentException;

/**
 * Session-credential auth supplier.
 */
final readonly class SessionAuth implements AuthSupplier
{
    public function __construct(
        public string $sessionId,
        public string $sessionSecret,
    ) {
        if ($sessionId === '') {
            throw new InvalidArgumentException(
                'SessionAuth: sessionId must be a non-empty string'
            );
        }
        if ($sessionSecret === '') {
            throw new InvalidArgumentException(
                'SessionAuth: sessionSecret must be a non-empty string'
            );
        }
    }

    public function kind(): string
    {
        return 'session';
    }
}
