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
export class ProductsFacade {
  private cached: ProductCatalog | undefined;
  private inflight: Promise<ProductCatalog> | undefined;

  constructor(private readonly datasets: DatasetsFacade) {}

  /**
   * Returns the `ProductCatalog` built from the server's products dataset.
   * The first call fetches from `GET /v2/reference-data`; subsequent calls
   * return the memoized result instantly.
   */
  async catalog(): Promise<ProductCatalog> {
    if (this.cached !== undefined) return this.cached;
    if (this.inflight !== undefined) return this.inflight;

    this.inflight = this.datasets
      .get({ include: ['products'] })
      .then((bundle) => {
        const cat = ProductCatalog.fromDatasets(bundle);
        this.cached = cat;
        this.inflight = undefined;
        return cat;
      })
      .catch((err: unknown) => {
        this.inflight = undefined;
        throw err;
      });

    return this.inflight;
  }

  /**
   * Evict the cached catalog and re-fetch on the next `catalog()` call.
   * Returns the freshly fetched `ProductCatalog`.
   */
  async refresh(): Promise<ProductCatalog> {
    this.cached = undefined;
    this.inflight = undefined;
    return this.catalog();
  }
}
