/**
 * `isa.zyins.products` — typed product catalog facade.
 *
 * The nested-by-type catalog (`Products.Fex.AetnaAccendo`, …) is generated
 * from the canonical product list and shipped inside the SDK; live calls
 * are unnecessary for the typed shape. This facade exposes the catalog and
 * the helper lookups for parity with prior callers.
 *
 * `refresh()` is a no-op today; it remains in the surface so future
 * server-driven catalog refresh lands without an API-shape change.
 */

import { Products, type Product, type ProductTypeValue } from './product';

/** `isa.zyins.products` — typed catalog access. */
export class ProductsFacade {
  // Constructor accepts an opaque dependency so the namespace wiring stays
  // identical between releases; we don't read from it today.
  constructor(_deps?: unknown) {}

  /** Returns the nested-by-type catalog. */
  catalog(): typeof Products {
    return Products;
  }

  /** Resolve a product by wire-token slug. */
  byWireToken(token: string): Product | undefined {
    return Products.byWireToken(token);
  }

  /** Resolve a product by legacy display name within a type. */
  byLegacy(productType: ProductTypeValue, displayName: string): Product | undefined {
    return Products.byLegacy(productType, displayName);
  }

  /** No-op today — the catalog is statically embedded. */
  async refresh(): Promise<typeof Products> {
    return Products;
  }
}
