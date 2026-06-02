<?php

declare(strict_types=1);

namespace Isa\Sdk\Tests\Catalog;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use Isa\Sdk\Catalog\Carriers;
use Isa\Sdk\Catalog\ErrorAdviceCodes;
use Isa\Sdk\Catalog\ErrorCode;
use Isa\Sdk\Catalog\ErrorDocUrls;
use Isa\Sdk\Catalog\FexProducts;
use Isa\Sdk\Catalog\Product;
use Isa\Sdk\Catalog\Products;
use Isa\Sdk\Catalog\Scope;
use Isa\Sdk\Catalog\ScopeDescriptions;
use Isa\Sdk\Catalog\SignEvent;
use Isa\Sdk\Catalog\SignEventLabels;
use Isa\Sdk\Catalog\State;
use Isa\Sdk\Catalog\States;

#[CoversClass(Products::class)]
#[CoversClass(FexProducts::class)]
#[CoversClass(Carriers::class)]
#[CoversClass(States::class)]
#[CoversClass(Product::class)]
final class CatalogTest extends TestCase
{
    // -------------------------------------------------------------------------
    // Products rich catalog
    // -------------------------------------------------------------------------

    public function testFexAetnaAccendoHasExpectedId(): void
    {
        $p = Products::fex()->aetnaAccendo();
        self::assertSame('prod_d7b57156-3e83-506b-8936-0692c1193dc7', $p->id);
        self::assertSame('Aetna Accendo', $p->name);
        self::assertSame('fex', $p->class);
        self::assertSame('Aetna', $p->carrier);
    }

    public function testByIdReturnsSameProductAsConstant(): void
    {
        $constant = Products::fex()->aetnaAccendo();
        $byId = Products::byId($constant->id);
        self::assertNotNull($byId);
        self::assertSame($constant->id, $byId->id);
        self::assertSame($constant->name, $byId->name);
        self::assertSame($constant->class, $byId->class);
        self::assertSame($constant->carrier, $byId->carrier);
    }

    public function testByIdReturnsNullForUnknownId(): void
    {
        self::assertNull(Products::byId('prod_00000000-0000-0000-0000-000000000000'));
    }

    public function testByIdDoesNotAcceptStaleNames(): void
    {
        // Only ids resolve — stale names, slugs, and display strings return null
        self::assertNull(Products::byId('fex-aetna-accendo'));
        self::assertNull(Products::byId('Aetna Accendo'));
        self::assertNull(Products::byId('aetna'));
    }

    public function testTermFamilyAccessorReturnsProducts(): void
    {
        $p = Products::term()->americanAmicableEasyTerm();
        self::assertStringStartsWith('prod_', $p->id);
        self::assertSame('term', $p->class);
    }

    public function testMedsupFamilyAccessorReturnsProducts(): void
    {
        $p = Products::medsup()->aetnaAccendoMedicareSupplement();
        self::assertStringStartsWith('prod_', $p->id);
        self::assertSame('medsup', $p->class);
    }

    public function testPreneedFamilyAccessorReturnsProducts(): void
    {
        $p = Products::preneed()->betterlifeSinglePremium();
        self::assertStringStartsWith('prod_', $p->id);
        self::assertSame('preneed', $p->class);
    }

    // -------------------------------------------------------------------------
    // Carriers catalog
    // -------------------------------------------------------------------------

    public function testCarriersMetadataReturnsExpectedShape(): void
    {
        $meta = Carriers::metadata('aetna');
        self::assertSame('Aetna', $meta->displayName);
        // Products are now keyed by prod_ id
        foreach ($meta->products as $prodId) {
            self::assertStringStartsWith('prod_', $prodId);
        }
    }

    // -------------------------------------------------------------------------
    // States catalog
    // -------------------------------------------------------------------------

    public function testStatesByAbbreviationResolvesAbbrAndName(): void
    {
        self::assertSame(State::NorthCarolina, States::byAbbreviation('NC'));
        self::assertSame(State::NorthCarolina, States::byAbbreviation('nc'));
        self::assertSame(State::NorthCarolina, States::byAbbreviation('North Carolina'));
        self::assertNull(States::byAbbreviation('XX'));
    }

    public function testStatesMetadataMarksTerritoryFlag(): void
    {
        $meta = States::metadata(State::PuertoRico);
        self::assertTrue($meta->isTerritory);
        $meta2 = States::metadata(State::NorthCarolina);
        self::assertFalse($meta2->isTerritory);
    }

    // -------------------------------------------------------------------------
    // Scope / SignEvent / ErrorCode catalogs
    // -------------------------------------------------------------------------

    public function testScopeEnumExposesWireValues(): void
    {
        self::assertSame('rapidsign:documents:write', Scope::RapidsignDocumentsWrite->value);
    }

    public function testSignEventEnumExposesDocumentSigned(): void
    {
        self::assertSame('document.signed', SignEvent::DocumentSigned->value);
    }

    public function testErrorAdviceCodeForValidation(): void
    {
        self::assertSame('fix_request_body', ErrorAdviceCodes::for(ErrorCode::ValidationError));
    }

    public function testErrorDocUrlForNotFound(): void
    {
        self::assertSame(
            'https://docs.isaapi.com/errors/not_found',
            ErrorDocUrls::for(ErrorCode::NotFound),
        );
    }

    public function testErrorCatalogMapsCoverEveryErrorCode(): void
    {
        foreach (ErrorCode::cases() as $code) {
            self::assertArrayHasKey($code->value, ErrorAdviceCodes::all());
            self::assertArrayHasKey($code->value, ErrorDocUrls::all());
        }
    }

    public function testCatalogMapsCoverEveryEnumValue(): void
    {
        foreach (Scope::cases() as $scope) {
            self::assertArrayHasKey($scope->value, ScopeDescriptions::all());
        }

        foreach (SignEvent::cases() as $event) {
            self::assertArrayHasKey($event->value, SignEventLabels::all());
        }
    }
}
