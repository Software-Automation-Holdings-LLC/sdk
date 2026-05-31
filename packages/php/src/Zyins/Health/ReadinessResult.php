<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Health;

/**
 * Typed response from {@see Service::getReadiness()}. Mirrors the proto
 * `ReadinessResponse` from `shared/schemas/api/isa/v1/health.proto`.
 */
final readonly class ReadinessResult
{
    /**
     * @param bool                       $ready              True iff every required probe returned `serving`.
     * @param string                     $status             Overall serving status (`serving`, `not_serving`, `unknown`).
     * @param ProbeResult                $db                 Primary dependency probe (database).
     * @param ProbeResult                $cache              Secondary dependency probe (cache).
     * @param array<string,ProbeResult>  $downstreamServices Additional probes keyed by service name.
     * @param string                     $checkedAt          ISO 8601 evaluation timestamp.
     */
    public function __construct(
        public bool $ready,
        public string $status,
        public ProbeResult $db,
        public ProbeResult $cache,
        public array $downstreamServices,
        public string $checkedAt,
    ) {
    }

    /**
     * @param array<int|string,mixed> $data
     */
    public static function fromWire(array $data): self
    {
        $downstream = [];
        if (isset($data['downstream_services']) && is_array($data['downstream_services'])) {
            foreach ($data['downstream_services'] as $name => $probe) {
                if (is_string($name)) {
                    $downstream[$name] = ProbeResult::fromWire($probe);
                }
            }
        }
        return new self(
            ready: isset($data['ready']) && $data['ready'] === true,
            status: isset($data['status']) && is_string($data['status']) ? $data['status'] : 'unknown',
            db: ProbeResult::fromWire($data['db'] ?? null),
            cache: ProbeResult::fromWire($data['cache'] ?? null),
            downstreamServices: $downstream,
            checkedAt: isset($data['checked_at']) && is_string($data['checked_at']) ? $data['checked_at'] : '',
        );
    }
}
