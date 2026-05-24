<?php

declare(strict_types=1);

namespace Sah\Sdk\Zyins\Products;

use Sah\Sdk\Zyins\ProductCatalog;

/**
 * `$client->products` — live product catalog with memoization.
 *
 * {@see catalog()} calls the datasets service's `get(include: ['products'])`
 * once and memoizes the resulting {@see ProductCatalog} for the lifetime of
 * the facade instance. Subsequent calls return the cached catalog without a
 * network round-trip.
 *
 * The catalog is invalidated only on facade recreation. For long-lived
 * processes that need fresh product lists, call {@see refresh()} to force
 * a re-fetch.
 */
final class Facade
{
    private const PRODUCTS_INCLUDE = 'products';

    private ?ProductCatalog $cached = null;

    /**
     * @param callable(array<string,mixed>): array<string,mixed> $datasetsGet
     */
    public function __construct(private readonly mixed $datasetsGet) {}

    /**
     * Returns the {@see ProductCatalog} built from the server's products dataset.
     *
     * The first call fetches from `GET /v1/reference-data`; subsequent calls
     * return the memoized result instantly.
     */
    public function catalog(): ProductCatalog
    {
        if ($this->cached !== null) {
            return $this->cached;
        }
        $bundle = ($this->datasetsGet)(['include' => self::PRODUCTS_INCLUDE]);
        $this->cached = ProductCatalog::fromDatasets($bundle);
        return $this->cached;
    }

    /**
     * Evict the cached catalog and re-fetch on the next {@see catalog()} call.
     *
     * Returns the freshly fetched {@see ProductCatalog}.
     */
    public function refresh(): ProductCatalog
    {
        $this->cached = null;
        return $this->catalog();
    }
}
