<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins;

use InvalidArgumentException;

/**
 * A single product offered by a carrier. `wireToken` is the engine's
 * canonical brand-and-type string; `displayName` is for UI rendering.
 */
final readonly class Product
{
    public function __construct(
        public string $brand,
        public ProductType $type,
        public string $wireToken,
        public string $displayName,
    ) {
        if ($this->brand === '' || $this->wireToken === '') {
            throw new InvalidArgumentException('Product requires non-empty brand and wireToken');
        }
    }

    /**
     * Returns the wire token array the prequalify body's `products` field accepts.
     * Prefer this over {@see toWireString()} — the server takes `string[]`, not a
     * joined string.
     *
     * @param  Product[] $products
     * @return string[]
     */
    public static function toWireArray(array $products): array
    {
        if ($products === []) {
            throw new InvalidArgumentException('Product::toWireArray: at least one product is required');
        }
        return array_values(array_map(static fn (Product $p): string => $p->wireToken, $products));
    }

    /**
     * @deprecated Use {@see toWireArray()} instead. The server's `products` field is
     *             `string[]`; joining with `|` is a legacy convention. Will be removed in v0.7.0.
     *
     * @param Product[] $products
     */
    public static function toWireString(array $products): string
    {
        if ($products === []) {
            throw new InvalidArgumentException('Product::toWireString: at least one product is required');
        }
        return implode('|', array_map(static fn (Product $p): string => $p->wireToken, $products));
    }
}
