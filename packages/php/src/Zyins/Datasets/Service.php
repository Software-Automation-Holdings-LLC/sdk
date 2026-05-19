<?php

declare(strict_types=1);

namespace Sah\Sdk\Zyins\Datasets;

use Sah\Sdk\Zyins\RequestOptions;
use Sah\Sdk\Zyins\Transport;

/**
 * Datasets sub-service. Exposes the engine's data-pack listing and
 * inspection endpoints. Today only `list` is shipped; future
 * `download` / `manifest` calls land here without churning the
 * client surface.
 */
final readonly class Service
{
    private const LIST_PATH = '/v1/datasets';

    public function __construct(private Transport $transport)
    {
    }

    /**
     * Return the catalog of datasets the caller is licensed to access.
     *
     * @return array<int,array<string,mixed>>
     */
    public function list(?RequestOptions $options = null): array
    {
        $response = $this->transport->get(self::LIST_PATH, $options);
        $items = $response->data['items'] ?? [];
        return is_array($items) ? array_values(array_filter($items, 'is_array')) : [];
    }
}
