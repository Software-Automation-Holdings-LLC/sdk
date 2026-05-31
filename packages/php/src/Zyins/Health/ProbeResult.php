<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Health;

/**
 * Per-dependency probe outcome carried inside the readiness response.
 * Mirrors the proto `ProbeResult` from
 * `shared/schemas/api/isa/v1/health.proto`.
 */
final readonly class ProbeResult
{
    /**
     * @param string $status    Wire value: `serving`, `not_serving`, `unknown`.
     * @param int    $latencyMs Observed RTT in milliseconds (zero on failure).
     * @param string $message   Human-readable explanation when not serving.
     * @param string $checkedAt ISO 8601 timestamp.
     */
    public function __construct(
        public string $status,
        public int $latencyMs,
        public string $message,
        public string $checkedAt,
    ) {
    }

    /**
     * @param array<int|string,mixed>|null $data
     */
    public static function fromWire(mixed $data): self
    {
        if (! is_array($data)) {
            return new self('unknown', 0, '', '');
        }
        return new self(
            status: isset($data['status']) && is_string($data['status']) ? $data['status'] : 'unknown',
            latencyMs: isset($data['latency_ms']) && is_numeric($data['latency_ms']) ? (int) $data['latency_ms'] : 0,
            message: isset($data['message']) && is_string($data['message']) ? $data['message'] : '',
            checkedAt: isset($data['checked_at']) && is_string($data['checked_at']) ? $data['checked_at'] : '',
        );
    }
}
