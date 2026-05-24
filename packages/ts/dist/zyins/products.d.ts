/**
 * `isa.zyins.products` — live product catalog built from server datasets.
 *
 * `catalog()` calls `isa.zyins.datasets.get({ include: ['products'] })` once
 * and memoizes the resulting `ProductCatalog` for the lifetime of the facade
 * instance. Subsequent calls return the cached catalog without a network
 * round-trip.
 *
 * The catalog is invalidated only on facade recreation (i.e. `Isa` instance
 * recreation). For long-lived processes that need fresh product lists, call
 * `refresh()` to force a re-fetch.
 */
import { ProductCatalog } from './product';
import { type DatasetsFacade } from './isaNamespaces';
/** `isa.zyins.products` — live product catalog with memoization. */
export declare class ProductsFacade {
    private readonly datasets;
    private cached;
    private inflight;
    constructor(datasets: DatasetsFacade);
    /**
     * Returns the `ProductCatalog` built from the server's products dataset.
     * The first call fetches from `GET /v2/reference-data`; subsequent calls
     * return the memoized result instantly.
     */
    catalog(): Promise<ProductCatalog>;
    /**
     * Evict the cached catalog and re-fetch on the next `catalog()` call.
     * Returns the freshly fetched `ProductCatalog`.
     */
    refresh(): Promise<ProductCatalog>;
}
//# sourceMappingURL=products.d.ts.map