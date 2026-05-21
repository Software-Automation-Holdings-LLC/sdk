<?php

declare(strict_types=1);

namespace Sah\Sdk\Tests\Catalog;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use Sah\Sdk\Catalog\Carriers;
use Sah\Sdk\Catalog\ErrorAdviceCodes;
use Sah\Sdk\Catalog\ErrorCode;
use Sah\Sdk\Catalog\ErrorDocUrls;
use Sah\Sdk\Catalog\Product;
use Sah\Sdk\Catalog\Products;
use Sah\Sdk\Catalog\Scope;
use Sah\Sdk\Catalog\ScopeDescriptions;
use Sah\Sdk\Catalog\SignEvent;
use Sah\Sdk\Catalog\SignEventLabels;
use Sah\Sdk\Catalog\State;
use Sah\Sdk\Catalog\States;

#[CoversClass(Products::class)]
#[CoversClass(Carriers::class)]
#[CoversClass(States::class)]
#[CoversClass(Product::class)]
final class CatalogTest extends TestCase
{
    public function testProductConstantsResolveToSlugs(): void
    {
        self::assertSame('fex-aetna-accendo', Product::AETNA_ACCENDO_FEX);
    }

    public function testProductsValuesIsNonEmpty(): void
    {
        $values = Products::values();
        self::assertNotEmpty($values);
        self::assertContains('fex-aetna-accendo', $values);
    }

    public function testProductsMetadataReturnsExpectedShape(): void
    {
        $meta = Products::metadata(Product::AETNA_ACCENDO_FEX);
        self::assertSame('fex-aetna-accendo', $meta->slug);
        self::assertSame('Aetna Accendo', $meta->displayName);
        self::assertSame('aetna', $meta->carrier);
        self::assertSame('fex', $meta->productClass);
        self::assertContains('Aetna Accendo Montana', $meta->stateVariations);
    }

    public function testProductsByCarrierResolvesBothSlugAndDisplayName(): void
    {
        $bySlug = Products::byCarrier('aetna');
        $byName = Products::byCarrier('Aetna');
        self::assertSame($bySlug, $byName);
        self::assertContains('fex-aetna-accendo', $bySlug);
    }

    public function testProductsSearchPrefersPrefix(): void
    {
        $results = Products::search('aetna');
        self::assertNotEmpty($results);
        // Aetna products should appear first
        $first = $results[0];
        self::assertStringContainsString('aetna', $first);
    }

    public function testCarriersMetadataReturnsExpectedShape(): void
    {
        $meta = Carriers::metadata('aetna');
        self::assertSame('Aetna', $meta->displayName);
        self::assertContains('fex-aetna-accendo', $meta->products);
    }

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
