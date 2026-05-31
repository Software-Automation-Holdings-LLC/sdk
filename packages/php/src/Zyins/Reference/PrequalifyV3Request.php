<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Reference;

use InvalidArgumentException;
use Isa\Sdk\Zyins\Applicant;
use Isa\Sdk\Zyins\Coverage;
use Isa\Sdk\Zyins\Product;

/**
 * Inputs accepted by `PrequalifyV3::run()`.
 *
 * Mirrors the TS `PrequalifyV3Request` shape: applicant + coverage +
 * products + optional {@see PrequalifyV3Options}. Wire serialization is
 * the service's responsibility — value objects stay in the domain
 * language (camelCase, integer inches/pounds, typed coverage, typed
 * products).
 */
final readonly class PrequalifyV3Request
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
            throw new InvalidArgumentException('PrequalifyV3Request requires at least one product');
        }
        foreach ($this->products as $product) {
            if (! $product instanceof Product) {
                throw new InvalidArgumentException(
                    'PrequalifyV3Request.products must contain Isa\\Sdk\\Zyins\\Product instances only',
                );
            }
        }
    }
}
