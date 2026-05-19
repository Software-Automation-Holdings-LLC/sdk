<?php

declare(strict_types=1);

namespace Sah\Sdk\Zyins;

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
     */
    public function __construct(
        public int $status,
        public array $headers,
        public string $url,
        public string $body,
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
