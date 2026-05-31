<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\ReferenceData;

use Isa\Sdk\Zyins\RequestOptions;
use Isa\Sdk\Zyins\Transport;

/**
 * Reference-data sub-service. Returns the conditions / medications /
 * carriers the engine recognizes — the typeahead inputs every front-
 * end form needs. All endpoints are GETs and idempotent.
 */
final readonly class Service
{
    private const CONDITIONS_PATH = '/v1/reference/conditions';
    private const MEDICATIONS_PATH = '/v1/reference/medications';
    private const CARRIERS_PATH = '/v1/reference/carriers';

    public function __construct(private Transport $transport)
    {
    }

    /** @return array<int,array<string,mixed>> */
    public function conditions(?RequestOptions $options = null): array
    {
        return self::items($this->transport->get(self::CONDITIONS_PATH, $options)->data);
    }

    /** @return array<int,array<string,mixed>> */
    public function medications(?RequestOptions $options = null): array
    {
        return self::items($this->transport->get(self::MEDICATIONS_PATH, $options)->data);
    }

    /** @return array<int,array<string,mixed>> */
    public function carriers(?RequestOptions $options = null): array
    {
        return self::items($this->transport->get(self::CARRIERS_PATH, $options)->data);
    }

    /**
     * @param array<int|string,mixed> $decoded
     * @return array<int,array<string,mixed>>
     */
    private static function items(array $decoded): array
    {
        $items = $decoded['items'] ?? [];
        return is_array($items) ? array_values(array_filter($items, 'is_array')) : [];
    }
}
