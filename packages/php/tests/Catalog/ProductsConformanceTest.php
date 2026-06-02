<?php

declare(strict_types=1);

namespace Isa\Sdk\Tests\Catalog;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use Isa\Sdk\Catalog\FexProducts;
use Isa\Sdk\Catalog\Product;
use Isa\Sdk\Catalog\Products;

/**
 * Conformance tests for the id-only product catalog.
 *
 * Spec: `byId(Products::fex()->aetnaAccendo()->id)` equals the constant,
 * and a stale name/slug returns null (only ids resolve).
 */
#[CoversClass(Products::class)]
#[CoversClass(FexProducts::class)]
#[CoversClass(Product::class)]
final class ProductsConformanceTest extends TestCase
{
    /** Aetna Accendo FEX — the canonical conformance product. */
    private const AETNA_ACCENDO_ID = 'prod_d7b57156-3e83-506b-8936-0692c1193dc7';

    public function testByIdWithConstantIdReturnsEqualProduct(): void
    {
        $constant = Products::fex()->aetnaAccendo();
        $lookedUp = Products::byId($constant->id);

        self::assertNotNull($lookedUp, 'byId must return a Product for a known constant id');
        self::assertSame($constant->id, $lookedUp->id);
        self::assertSame($constant->name, $lookedUp->name);
        self::assertSame($constant->class, $lookedUp->class);
        self::assertSame($constant->carrier, $lookedUp->carrier);
    }

    public function testConstantIdMatchesCanonicalAetnaAccendo(): void
    {
        self::assertSame(self::AETNA_ACCENDO_ID, Products::fex()->aetnaAccendo()->id);
    }

    public function testStaleNameReturnsNull(): void
    {
        // A stale display name must NOT resolve — only ids work.
        self::assertNull(Products::byId('Aetna Accendo'));
    }

    public function testStaleSlugReturnsNull(): void
    {
        // Legacy slugs must NOT resolve — they are display/provenance metadata.
        self::assertNull(Products::byId('fex-aetna-accendo'));
    }

    public function testRandomStringReturnsNull(): void
    {
        self::assertNull(Products::byId('not-a-real-id'));
    }

    public function testAllFamilyAccessorsReturnProdPrefixedIds(): void
    {
        $checks = [
            Products::fex()->aetnaAccendo(),
            Products::term()->americanAmicableEasyTerm(),
            Products::medsup()->aetnaAccendoMedicareSupplement(),
            Products::preneed()->betterlifeSinglePremium(),
        ];
        foreach ($checks as $product) {
            self::assertStringStartsWith('prod_', $product->id, "Product {$product->name} must have a prod_ id");
            self::assertNotEmpty($product->name);
            self::assertNotEmpty($product->class);
            self::assertNotEmpty($product->carrier);
        }
    }

    public function testProductWireArrayUsesIds(): void
    {
        $products = [
            Products::fex()->aetnaAccendo(),
            Products::term()->americanAmicableEasyTerm(),
        ];
        $wire = \Isa\Sdk\Zyins\Product::toWireArray(
            array_map(
                static fn (\Isa\Sdk\Catalog\Product $p): \Isa\Sdk\Zyins\Product =>
                    new \Isa\Sdk\Zyins\Product(id: $p->id, name: $p->name, class: $p->class, carrier: $p->carrier),
                $products,
            )
        );
        foreach ($wire as $id) {
            self::assertStringStartsWith('prod_', $id, "Wire products must be prod_ ids, got: {$id}");
        }
    }
}
