<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins;

use InvalidArgumentException;
use Isa\Sdk\Catalog\Product as CatalogProduct;

/**
 * A single product in the ISA catalog.
 *
 * `id` is the opaque `prod_<uuid>` identifier — the ONLY value the v3
 * prequalify `products[]` filter accepts. `name`, `class`, and `carrier`
 * are display affordances only; carriers rename products, so these fields
 * are mutable and must never be used as identity or sent on the wire.
 *
 * Obtain instances via the typed catalog, not by direct construction:
 *
 *     Products::fex()->aetnaAccendo()
 *     Products::byId('prod_d7b57156-3e83-506b-8936-0692c1193dc7')
 */
final readonly class Product
{
    public function __construct(
        /** Opaque product id (`prod_<uuid>`). The only stable identity and wire value. */
        public string $id,
        /** Display name (e.g. `"Aetna Accendo"`). Mutable — never store as identity. */
        public string $name,
        /** Product class (`"fex"`, `"term"`, `"medsup"`, `"preneed"`, …). */
        public string $class,
        /** Carrier display name (e.g. `"Aetna"`). */
        public string $carrier,
    ) {
        if ($this->id === '') {
            throw new InvalidArgumentException('Product requires a non-empty id');
        }
    }

    /**
     * Returns the id array the v3 prequalify body's `products` field accepts.
     *
     * Accepts both `Isa\Sdk\Zyins\Product` and `Isa\Sdk\Catalog\Product`
     * instances — both carry the same `id` field (prod_<uuid>).
     *
     * @param  list<Product|CatalogProduct> $products
     * @return list<string>
     * @throws InvalidArgumentException when the list is empty
     */
    public static function toWireArray(array $products): array
    {
        if ($products === []) {
            throw new InvalidArgumentException('Product::toWireArray: at least one product is required');
        }
        return array_values(array_map(static fn (Product|CatalogProduct $p): string => $p->id, $products));
    }
}
