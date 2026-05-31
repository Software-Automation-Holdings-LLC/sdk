<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins;

/**
 * Per-request overrides callers may set without breaking the rest of
 * the client configuration. Builds via fluent `with*` methods because
 * mixing optional ctor args at the call site is a bad UX.
 */
final readonly class RequestOptions
{
    /**
     * @param array<string,string> $extraHeaders Lowercased keys aren't required —
     *        the transport writes them through verbatim.
     */
    private function __construct(
        public ?string $idempotencyKey = null,
        public ?string $version = null,
        public array $extraHeaders = [],
    ) {
    }

    public static function default(): self
    {
        return new self();
    }

    public function withIdempotencyKey(string $key): self
    {
        return new self(idempotencyKey: $key, version: $this->version, extraHeaders: $this->extraHeaders);
    }

    public function withVersion(string $version): self
    {
        return new self(idempotencyKey: $this->idempotencyKey, version: $version, extraHeaders: $this->extraHeaders);
    }

    /**
     * Layer additional request headers (e.g. `If-None-Match` for ETag
     * revalidation). New entries merge over previous ones by name.
     *
     * Rejects names the transport already owns (`Authorization`,
     * `Idempotency-Key`, `Version`, `User-Agent`, `Content-Type`,
     * `Accept`): a caller silently overriding `Authorization` would
     * desynchronize the auth scheme without surfacing on any typed API.
     * Use the dedicated builders for those (`withIdempotencyKey`,
     * `withVersion`); this method is for additive headers only.
     *
     * @param array<string,string> $headers
     * @throws \InvalidArgumentException when a reserved header name is supplied.
     */
    public function withExtraHeaders(array $headers): self
    {
        $reserved = self::reservedHeaderNames();
        foreach (array_keys($headers) as $name) {
            if (isset($reserved[strtolower((string) $name)])) {
                throw new \InvalidArgumentException(sprintf(
                    'RequestOptions::withExtraHeaders refuses reserved header "%s"; ' .
                    'use the dedicated builder (withIdempotencyKey/withVersion) ' .
                    'or rely on transport defaults.',
                    (string) $name,
                ));
            }
        }
        return new self(
            idempotencyKey: $this->idempotencyKey,
            version: $this->version,
            extraHeaders: array_replace($this->extraHeaders, $headers),
        );
    }

    /** @return array<string,bool> Lowercased header names → true. */
    private static function reservedHeaderNames(): array
    {
        return [
            'authorization' => true,
            'idempotency-key' => true,
            'version' => true,
            'user-agent' => true,
            'content-type' => true,
            'accept' => true,
        ];
    }
}
