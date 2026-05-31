<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Reference;

use InvalidArgumentException;
use Isa\Sdk\Zyins\Applicant;
use Isa\Sdk\Zyins\Coverage;
use Isa\Sdk\Zyins\Product;

/**
 * Inputs accepted by `QuoteV3::run()`. Same shape as
 * {@see PrequalifyV3Request}; the response groups qualifying products
 * by requested amount for side-by-side comparison tables.
 */
final readonly class QuoteV3Request
{
    /**
     * @param list<Product> $products
     */
    public function __construct(
        public Applicant $applicant,
        public Coverage $coverage,
        public array $products,
        public ?PrequalifyV3Options $options = null,
    ) {
        if ($this->products === []) {
            throw new InvalidArgumentException('QuoteV3Request requires at least one product');
        }
        foreach ($this->products as $product) {
            if (! $product instanceof Product) {
                throw new InvalidArgumentException(
                    'QuoteV3Request.products must contain Isa\\Sdk\\Zyins\\Product instances only',
                );
            }
        }
    }
}
