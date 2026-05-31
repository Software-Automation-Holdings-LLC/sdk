<?php

declare(strict_types=1);

namespace Isa\Sdk\Core;

use DateTimeImmutable;

/**
 * Cached credential bundle returned by POST /v1/sessions.
 *
 * Immutable value object. The `secret` is the HMAC key used to sign
 * every steady-state request. Treat as a credential: never log,
 * never persist beyond memory.
 */
final readonly class Session
{
    public function __construct(
        public string $sessionId,
        public string $sessionSecret,
        public DateTimeImmutable $expiresAt,
    ) {
    }
}
