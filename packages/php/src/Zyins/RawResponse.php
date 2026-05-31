<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins;

/**
 * Read-only snapshot of the HTTP response the SDK transport observed.
 *
 * Returned alongside the typed result from every `*WithRawResponse(...)`
 * variant. Mirrors the Stainless / OpenAI / Anthropic SDK shape:
 * callers needing the raw `Retry-After`, response headers, or the
 * effective URL after redirects can read it directly without
 * subclassing the transport.
 */
final readonly class RawResponse
{
    /**
     * @param array<string,array<int,string>> $headers Lowercased header names → values.
     * @param string|null $sentIdempotencyKey The `Idempotency-Key` value the
     *        transport actually wrote on the wire — including UUIDs minted by
     *        the transport when the caller did not supply one via
     *        {@see RequestOptions::withIdempotencyKey()}. `null` for GETs
     *        (no `Idempotency-Key` emitted) and for endpoints that bypass
     *        the transport's idempotency plumbing. Lets v3 services echo the
     *        right key into typed results and forward it to
     *        {@see Transport::exceptionFromRaw()} so 409 conflict exceptions
     *        carry the key.
     */
    public function __construct(
        public int $status,
        public array $headers,
        public string $url,
        public string $body,
        public ?string $sentIdempotencyKey = null,
    ) {
    }

    /** Returns the first value of a header (case-insensitive), or null. */
    public function header(string $name): ?string
    {
        $lower = strtolower($name);
        foreach ($this->headers as $key => $values) {
            if (strtolower($key) === $lower) {
                return $values[0] ?? null;
            }
        }
        return null;
    }
}
