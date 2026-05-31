<?php

declare(strict_types=1);

namespace Isa\Sdk\Proxy\Call;

use Isa\Sdk\Proxy\Exception\ProxyException;

/**
 * The downstream response, surfaced verbatim through the proxy.
 *
 * Mirrors `ProxyCallResponse` in JS and the Go transport's return type.
 * The proxy does NOT unwrap the downstream body — callers receive the
 * exact status, headers, and body the integration emitted.
 */
final readonly class InvokeResult
{
    /**
     * @param array<string,string> $headers Downstream response headers (string→string).
     * @param mixed $body Downstream response body (decoded JSON value, raw string, or null).
     */
    public function __construct(
        public int $status,
        public array $headers,
        public mixed $body,
        public ?string $requestId = null,
    ) {
    }

    /**
     * @param array<string,mixed> $payload Decoded proxy response (envelope already unwrapped).
     */
    public static function fromPayload(array $payload, ?string $requestId = null): self
    {
        $status = $payload['status'] ?? null;
        if (! is_int($status)) {
            throw new ProxyException(
                message: 'proxy: invoke response missing integer status',
                errorCode: 'invalid_response',
            );
        }
        $headers = is_array($payload['headers'] ?? null) ? self::stringMap($payload['headers']) : [];
        return new self(
            status: $status,
            headers: $headers,
            body: $payload['body'] ?? null,
            requestId: $requestId,
        );
    }

    /**
     * @param array<mixed> $value
     * @return array<string,string>
     */
    private static function stringMap(array $value): array
    {
        $out = [];
        foreach ($value as $k => $v) {
            if (is_string($k) && is_string($v)) {
                $out[$k] = $v;
            }
        }
        return $out;
    }
}
