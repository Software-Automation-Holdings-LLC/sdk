<?php

declare(strict_types=1);

namespace Sah\Sdk\Zyins\Health;

use Sah\Sdk\Zyins\RequestOptions;
use Sah\Sdk\Zyins\Transport;

/**
 * Health sub-service. Exposes the shared platform `/ready` probe per
 * `shared/schemas/api/isa/v1/health.proto`. Liveness (`/health`) lands
 * in a follow-up; readiness is the first surfaced operation because
 * it is the signal load balancers and runbooks rely on.
 */
final readonly class Service
{
    private const READINESS_PATH = '/ready';

    public function __construct(private Transport $transport)
    {
    }

    /**
     * Query the readiness probe. The endpoint is unauthenticated; an
     * attached bearer token is harmless and lets one client struct
     * serve every operation.
     *
     * @throws \Sah\Sdk\Zyins\Exception\IsaException on a 5xx response (drain signal).
     */
    public function getReadiness(?RequestOptions $options = null): ReadinessResult
    {
        $response = $this->transport->get(self::READINESS_PATH, $options);
        return ReadinessResult::fromWire($response->data);
    }
}
