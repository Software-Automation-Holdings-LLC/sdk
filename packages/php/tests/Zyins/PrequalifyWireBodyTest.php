<?php

declare(strict_types=1);

namespace Sah\Sdk\Tests\Zyins;

use PHPUnit\Framework\TestCase;
use Sah\Sdk\Zyins\Applicant;
use Sah\Sdk\Zyins\Condition;
use Sah\Sdk\Zyins\Coverage;
use Sah\Sdk\Zyins\Height;
use Sah\Sdk\Zyins\Medication;
use Sah\Sdk\Zyins\NicotineDuration;
use Sah\Sdk\Zyins\NicotineProductUsage;
use Sah\Sdk\Zyins\NicotineUsage;
use Sah\Sdk\Zyins\NicotineUsageInput;
use Sah\Sdk\Zyins\Prequalify\Input;
use Sah\Sdk\Zyins\Product;
use Sah\Sdk\Zyins\ProductCatalog;
use Sah\Sdk\Zyins\ProductType;
use Sah\Sdk\Zyins\QuoteType;
use Sah\Sdk\Zyins\Sex;
use Sah\Sdk\Zyins\Weight;

/**
 * 0.5.1 flat wire body and new type tests.
 */
final class PrequalifyWireBodyTest extends TestCase
{
    private function johnDoeNc(): Applicant
    {
        return new Applicant(
            dob: '1962-04-18',
            sex: Sex::Male,
            height: Height::fromFeetInches(5, 10),
            weight: Weight::fromPounds(195),
            state: 'NC',
            nicotineUse: new NicotineUsageInput(NicotineDuration::Never),
        );
    }

    // -------------------------------------------------------------------------
    // Flat wire shape
    // -------------------------------------------------------------------------

    public function testWireBodyFlatTopLevelKeys(): void
    {
        $body = (new Input(
            applicant: $this->johnDoeNc(),
            coverage: Coverage::faceValue(25_000),
            products: [new Product('cp', ProductType::FinalExpense, 'senior-life', 'Senior Life')],
        ))->toWireBody();

        self::assertArrayHasKey('date_of_birth', $body);
        self::assertArrayHasKey('gender', $body);
        self::assertArrayHasKey('height', $body);
        self::assertArrayHasKey('weight', $body);
        self::assertArrayHasKey('state', $body);
        self::assertArrayHasKey('nicotine_usage', $body);
        self::assertArrayHasKey('products', $body);
        self::assertArrayHasKey('quote_options', $body);

        // Old nesting must not be present.
        self::assertArrayNotHasKey('applicant', $body);
        self::assertArrayNotHasKey('coverage', $body);
    }

    public function testWireBodyJohnDoeNcCanonical(): void
    {
        $body = (new Input(
            applicant: $this->johnDoeNc(),
            coverage: Coverage::faceValue(25_000),
            products: [new Product('cp', ProductType::FinalExpense, 'senior-life', 'Senior Life')],
        ))->toWireBody();

        self::assertSame('1962-04-18', $body['date_of_birth']);
        self::assertSame('male', $body['gender']);
        self::assertSame(70, $body['height']);
        self::assertSame(195, $body['weight']);
        self::assertSame('NC', $body['state']);
        self::assertSame('never', $body['nicotine_usage']['last_used']);
        self::assertSame(['senior-life'], $body['products']);
        self::assertSame(['25000'], $body['quote_options']['amounts']);
        self::assertSame('face_amounts', $body['quote_options']['quote_type']);
        self::assertSame([], $body['conditions']);
        self::assertSame([], $body['medications']);
    }

    public function testWireBodyEmitsCanonicalSexString(): void
    {
        $bodyMale = (new Input(
            applicant: $this->johnDoeNc(),
            coverage: Coverage::faceValue(25_000),
            products: [new Product('cp', ProductType::FinalExpense, 'tok', 'CP')],
        ))->toWireBody();
        self::assertSame('male', $bodyMale['gender']);

        $bodyFemale = (new Input(
            applicant: new Applicant(
                dob: '1985-11-02',
                sex: Sex::Female,
                height: Height::fromFeetInches(5, 6),
                weight: Weight::fromPounds(140),
                state: 'CA',
                nicotineUse: new NicotineUsageInput(NicotineDuration::Never),
            ),
            coverage: Coverage::faceValue(50_000),
            products: [new Product('x', ProductType::FinalExpense, 'tok', 'X')],
        ))->toWireBody();
        self::assertSame('female', $bodyFemale['gender']);
    }

    public function testWireBodyProductsIsArray(): void
    {
        $body = (new Input(
            applicant: $this->johnDoeNc(),
            coverage: Coverage::faceValue(25_000),
            products: [
                new Product('cp', ProductType::FinalExpense, 'cp.fex', 'CP'),
                new Product('moo', ProductType::FinalExpense, 'moo.fex', 'MOO'),
            ],
        ))->toWireBody();

        self::assertSame(['cp.fex', 'moo.fex'], $body['products']);
    }

    public function testWireBodyMonthlyBudgetQuoteType(): void
    {
        $body = (new Input(
            applicant: $this->johnDoeNc(),
            coverage: Coverage::monthlyBudget(50),
            products: [new Product('x', ProductType::FinalExpense, 'tok', 'X')],
        ))->toWireBody();

        self::assertSame('monthly_budget', $body['quote_options']['quote_type']);
        self::assertSame(['50'], $body['quote_options']['amounts']);
    }

    public function testWireBodyNicotineStructuredInput(): void
    {
        $body = (new Input(
            applicant: new Applicant(
                dob: '1985-11-02',
                sex: Sex::Female,
                height: Height::fromFeetInches(5, 6),
                weight: Weight::fromPounds(140),
                state: 'CA',
                nicotineUse: new NicotineUsageInput(NicotineDuration::Within12Months),
            ),
            coverage: Coverage::faceValue(50_000),
            products: [new Product('x', ProductType::FinalExpense, 'tok', 'X')],
        ))->toWireBody();

        self::assertSame('within_12_months', $body['nicotine_usage']['last_used']);
    }

    public function testNicotineUsageInputRejectsInvalidProductUsage(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('NicotineUsageInput.productUsage');

        /** @var array<NicotineProductUsage> $invalidProductUsage */
        $invalidProductUsage = ['not-a-product-usage'];
        new NicotineUsageInput(NicotineDuration::Within12Months, $invalidProductUsage);
    }

    public function testWireBodyNicotineProductUsageSerializes(): void
    {
        $body = (new Input(
            applicant: new Applicant(
                dob: '1985-11-02',
                sex: Sex::Female,
                height: Height::fromFeetInches(5, 6),
                weight: Weight::fromPounds(140),
                state: 'CA',
                nicotineUse: new NicotineUsageInput(
                    NicotineDuration::Within12Months,
                    [new NicotineProductUsage('CIGARETTE', 'DAILY')],
                ),
            ),
            coverage: Coverage::faceValue(50_000),
            products: [new Product('x', ProductType::FinalExpense, 'tok', 'X')],
        ))->toWireBody();

        self::assertSame('CIGARETTE', $body['nicotine_usage']['product_usage'][0]['type']);
        self::assertSame('DAILY', $body['nicotine_usage']['product_usage'][0]['frequency']);
    }

    public function testWireBodyNicolineLegacyEnumMaps(): void
    {
        $cases = [
            [NicotineUsage::None,    'never'],
            [NicotineUsage::Current, 'within_12_months'],
            [NicotineUsage::Former,  '12_to_24_months'],
        ];
        foreach ($cases as [$legacy, $expectedLastUsed]) {
            $body = (new Input(
                applicant: new Applicant(
                    dob: '1962-04-18',
                    sex: Sex::Male,
                    height: Height::fromFeetInches(5, 10),
                    weight: Weight::fromPounds(195),
                    state: 'NC',
                    nicotineUse: $legacy,
                ),
                coverage: Coverage::faceValue(25_000),
                products: [new Product('x', ProductType::FinalExpense, 'tok', 'X')],
            ))->toWireBody();
            self::assertSame($expectedLastUsed, $body['nicotine_usage']['last_used']);
        }
    }

    public function testWireBodyZipOmittedWhenNull(): void
    {
        $body = (new Input(
            applicant: $this->johnDoeNc(),
            coverage: Coverage::faceValue(25_000),
            products: [new Product('x', ProductType::FinalExpense, 'tok', 'X')],
        ))->toWireBody();

        self::assertArrayNotHasKey('zip', $body);
    }

    public function testWireBodyZipIncludedWhenSet(): void
    {
        $body = (new Input(
            applicant: new Applicant(
                dob: '1962-04-18',
                sex: Sex::Male,
                height: Height::fromFeetInches(5, 10),
                weight: Weight::fromPounds(195),
                state: 'NC',
                nicotineUse: new NicotineUsageInput(NicotineDuration::Never),
                zip: '27601',
            ),
            coverage: Coverage::faceValue(25_000),
            products: [new Product('x', ProductType::FinalExpense, 'tok', 'X')],
        ))->toWireBody();

        self::assertSame('27601', $body['zip']);
    }

    public function testWireBodyIncludesMedicationsAndConditions(): void
    {
        $body = (new Input(
            applicant: new Applicant(
                dob: '1962-04-18',
                sex: Sex::Male,
                height: Height::fromFeetInches(5, 10),
                weight: Weight::fromPounds(195),
                state: 'NC',
                nicotineUse: new NicotineUsageInput(NicotineDuration::Never),
                medications: [new Medication('LOSARTAN', 'HIGH BLOOD PRESSURE', '11 MONTHS AGO', '3 MONTHS AGO')],
                conditions: [new Condition('HBP', '3 YEARS AGO', '3 MONTHS AGO')],
            ),
            coverage: Coverage::faceValue(25_000),
            products: [new Product('x', ProductType::FinalExpense, 'tok', 'X')],
        ))->toWireBody();

        self::assertSame('LOSARTAN', $body['medications'][0]['name']);
        self::assertSame('HBP', $body['conditions'][0]['name']);
        self::assertArrayNotHasKey('applicant', $body);
    }

    // -------------------------------------------------------------------------
    // NicotineDuration enum
    // -------------------------------------------------------------------------

    public function testNicotineDurationValues(): void
    {
        self::assertSame('never',              NicotineDuration::Never->value);
        self::assertSame('within_12_months',   NicotineDuration::Within12Months->value);
        self::assertSame('12_to_24_months',    NicotineDuration::N12To24Months->value);
        self::assertSame('24_to_36_months',    NicotineDuration::N24To36Months->value);
        self::assertSame('36_to_48_months',    NicotineDuration::N36To48Months->value);
        self::assertSame('48_to_60_months',    NicotineDuration::N48To60Months->value);
        self::assertSame('over_60_months',     NicotineDuration::Over60Months->value);
    }

    // -------------------------------------------------------------------------
    // QuoteType enum
    // -------------------------------------------------------------------------

    public function testQuoteTypeValues(): void
    {
        self::assertSame('face_amounts',   QuoteType::FaceAmounts->value);
        self::assertSame('monthly_budget', QuoteType::MonthlyBudget->value);
    }

    // -------------------------------------------------------------------------
    // ProductCatalog
    // -------------------------------------------------------------------------

    public function testProductCatalogFromDatasetsParses(): void
    {
        $catalog = ProductCatalog::fromDatasets([
            'products' => [
                'fex' => [
                    ['identifier' => 'fex-cp', 'carrier' => 'colonial-penn', 'name' => 'CP FEX', 'product' => 'fex'],
                ],
            ],
        ]);

        $p = $catalog->findBySlug('fex-cp');
        self::assertSame('colonial-penn', $p->brand);
        self::assertSame('fex-cp', $p->wireToken);
        self::assertSame('CP FEX', $p->displayName);
    }

    public function testProductCatalogFindBySlugThrowsOnMiss(): void
    {
        $this->expectException(\OutOfBoundsException::class);
        ProductCatalog::fromDatasets(['products' => []])->findBySlug('nonexistent');
    }

    public function testProductCatalogTryFindBySlugReturnsNullOnMiss(): void
    {
        self::assertNull(
            ProductCatalog::fromDatasets(['products' => []])->tryFindBySlug('nonexistent')
        );
    }

    public function testProductCatalogFromDatasetsSkipsBadEntries(): void
    {
        $catalog = ProductCatalog::fromDatasets([
            'products' => [
                'fex' => [
                    ['identifier' => 'ok', 'carrier' => 'x', 'name' => 'X', 'product' => 'fex'],
                    ['identifier' => 'final-expense', 'carrier' => 'x', 'name' => 'X', 'product' => 'final_expense'],
                    ['identifier' => 'unknown', 'carrier' => 'x', 'name' => 'X', 'product' => 'unknown'],
                    ['identifier' => 'blank', 'carrier' => ' ', 'name' => 'X', 'product' => 'fex'],
                    ['missing' => 'fields'],
                    null,
                ],
            ],
        ]);
        self::assertCount(2, $catalog->list());
        self::assertSame(ProductType::FinalExpense, $catalog->findBySlug('final-expense')->type);
    }
}
