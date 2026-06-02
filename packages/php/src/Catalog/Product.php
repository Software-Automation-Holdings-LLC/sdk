<?php

declare(strict_types=1);

namespace Isa\Sdk\Catalog;

use InvalidArgumentException;

/**
 * Generated catalog — do not hand-edit; rerun `php scripts/gen-catalog.php`.
 *
 * A single product in the ISA catalog.
 *
 * `id` is the opaque `prod_<uuid>` identifier — the ONLY value the v3
 * prequalify `products[]` filter accepts. `name`, `carrier`, and `class`
 * are display affordances only; they are mutable (carriers rename products)
 * and must never be used as identity or sent on the wire.
 *
 * Obtain instances via {@see Products}:
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
}
