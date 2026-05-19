<?php

declare(strict_types=1);

namespace Sah\Sdk\Zyins\Usage;

use Sah\Sdk\Zyins\RequestOptions;
use Sah\Sdk\Zyins\Transport;

/**
 * Usage sub-service. Exposes the per-token call-counts and quota
 * state the dashboard surfaces. Useful for embedding billing
 * indicators directly in consumer apps.
 */
final readonly class Service
{
    private const SUMMARY_PATH = '/v1/usage/summary';

    public function __construct(private Transport $transport)
    {
    }

    /**
     * Return the current period's usage summary as the raw envelope
     * payload. The shape is `{period_start, period_end, calls, quota}`
     * — typed value object lands when the protobuf descriptors do.
     *
     * @return array<int|string,mixed>
     */
    public function summary(?RequestOptions $options = null): array
    {
        return $this->transport->get(self::SUMMARY_PATH, $options)->data;
    }
}
