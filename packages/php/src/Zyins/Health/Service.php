<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Health;

use Isa\Sdk\Zyins\RequestOptions;
use Isa\Sdk\Zyins\Transport;

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
     * @throws \Isa\Sdk\Zyins\Exception\IsaException on transport failures or non-2xx responses.
     */
    public function getReadiness(?RequestOptions $options = null): ReadinessResult
    {
        $response = $this->transport->get(self::READINESS_PATH, $options);
        return ReadinessResult::fromWire($response->data);
    }
}
