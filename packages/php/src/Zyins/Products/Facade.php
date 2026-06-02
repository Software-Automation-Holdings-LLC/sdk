<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Products;

/**
 * `$client->products` — namespace accessor for product-related operations.
 *
 * The static catalog constants in {@see \Isa\Sdk\Catalog\Products} are the
 * primary entry point for product selection:
 *
 *     use Isa\Sdk\Catalog\Products;
 *     $product = Products::fex()->aetnaAccendo();
 *
 * This facade exists for forward-compatibility as an injection point for
 * future live-catalog refresh operations.
 */
final class Facade
{
    /** @param callable(array<string,mixed>): array<string,mixed> $datasetsGet */
    public function __construct(private readonly mixed $datasetsGet) {}
}
