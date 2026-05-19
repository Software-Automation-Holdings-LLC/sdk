<?php

declare(strict_types=1);

namespace Sah\Sdk\Proxy;

/**
 * Per-request overrides callers may set without breaking the rest of
 * the client configuration. Builds via fluent `with*` methods because
 * mixing optional ctor args at the call site is a bad UX.
 */
final readonly class RequestOptions
{
    private function __construct(
        public ?string $idempotencyKey = null,
        public ?string $version = null,
    ) {
    }

    public static function default(): self
    {
        return new self();
    }

    public function withIdempotencyKey(string $key): self
    {
        return new self(idempotencyKey: $key, version: $this->version);
    }

    public function withVersion(string $version): self
    {
        return new self(idempotencyKey: $this->idempotencyKey, version: $version);
    }
}
