<?php

declare(strict_types=1);

namespace Sah\Sdk\Zyins;

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
     * Render a list of products to the prequalify wire string — a
     * `|`-joined list of wire tokens. The shape is the engine's stable
     * contract; locking it in here keeps call sites out of the regex.
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
