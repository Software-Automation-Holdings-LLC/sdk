<?php

declare(strict_types=1);

namespace Sah\Sdk\Proxy;

/**
 * The result of a successful Transport call.
 *
 * Carries the decoded `data` payload (already unwrapped from the
 * ADR-012 envelope) alongside the envelope's `request_id` correlation
 * token. The two travel together so result builders can stamp the id
 * onto the typed result without mutating the payload.
 */
final readonly class DecodedResponse
{
    public function __construct(
        /** @var array<string,mixed> */
        public array $data,
        public ?string $requestId,
    ) {
    }
}
