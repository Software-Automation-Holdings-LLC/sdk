<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins;

/**
 * The result of a successful Transport call.
 *
 * Carries the decoded `data` payload (already unwrapped from the
 * ADR-012 envelope) alongside the envelope's `request_id` correlation
 * token. The two travel together so result builders can stamp the
 * id onto the typed result without mutating the payload — a magic key
 * inside `data` collides with legitimate fields and breaks consumers
 * that iterate list-shaped responses.
 *
 * `data` is whatever the platform sent for that endpoint: associative
 * for object resources, list-shaped for collections, scalar-wrapped
 * for primitive returns. The result builders narrow it on read.
 */
final readonly class DecodedResponse
{
    public function __construct(
        /** @var array<int|string,mixed> */
        public array $data,
        public ?string $requestId,
        public string $idempotencyKey = '',
        public int $retryAttempts = 0,
    ) {
    }
}
