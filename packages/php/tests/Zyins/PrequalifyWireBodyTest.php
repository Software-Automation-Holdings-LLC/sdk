<?php

declare(strict_types=1);

namespace Isa\Sdk\Tests\Zyins;

use PHPUnit\Framework\TestCase;
use Isa\Sdk\Zyins\Applicant;
use Isa\Sdk\Zyins\Condition;
use Isa\Sdk\Zyins\Coverage;
use Isa\Sdk\Zyins\Height;
use Isa\Sdk\Zyins\Medication;
use Isa\Sdk\Zyins\NicotineDuration;
use Isa\Sdk\Zyins\NicotineProductUsage;
use Isa\Sdk\Zyins\NicotineUsage;
use Isa\Sdk\Zyins\NicotineUsageInput;
use Isa\Sdk\Zyins\Prequalify\Input;
use Isa\Sdk\Zyins\Product;
use Isa\Sdk\Zyins\QuoteType;
use Isa\Sdk\Zyins\Sex;
use Isa\Sdk\Zyins\Weight;

/**
 * Flat wire body shape and Product id-wire tests.
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

    private function fixtureProduct(): Product
    {
        return new Product(id: 'prod_d7b57156-3e83-506b-8936-0692c1193dc7', name: 'Aetna Accendo', class: 'fex', carrier: 'Aetna');
    }

    // -------------------------------------------------------------------------
    // Flat wire shape
    // -------------------------------------------------------------------------

    public function testWireBodyFlatTopLevelKeys(): void
    {
        $body = (new Input(
            applicant: $this->johnDoeNc(),
            coverage: Coverage::faceValue(25_000),
            products: [$this->fixtureProduct()],
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
            products: [$this->fixtureProduct()],
        ))->toWireBody();

        self::assertSame('1962-04-18', $body['date_of_birth']);
        self::assertSame('male', $body['gender']);
        self::assertSame(70, $body['height']);
        self::assertSame(195, $body['weight']);
        self::assertSame('NC', $body['state']);
        self::assertSame('never', $body['nicotine_usage']['last_used']);
        // Wire products must be the prod_ id, not a slug
        self::assertSame(['prod_d7b57156-3e83-506b-8936-0692c1193dc7'], $body['products']);
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
            products: [new Product(id: 'prod_a', name: 'CP', class: 'fex', carrier: 'CP')],
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
            products: [new Product(id: 'prod_b', name: 'X', class: 'fex', carrier: 'X')],
        ))->toWireBody();
        self::assertSame('female', $bodyFemale['gender']);
    }

    public function testWireBodyProductsIsArray(): void
    {
        $body = (new Input(
            applicant: $this->johnDoeNc(),
            coverage: Coverage::faceValue(25_000),
            products: [
                new Product(id: 'prod_cp', name: 'CP', class: 'fex', carrier: 'CP'),
                new Product(id: 'prod_moo', name: 'MOO', class: 'fex', carrier: 'MOO'),
            ],
        ))->toWireBody();

        self::assertSame(['prod_cp', 'prod_moo'], $body['products']);
    }

    public function testWireBodyMonthlyBudgetQuoteType(): void
    {
        $body = (new Input(
            applicant: $this->johnDoeNc(),
            coverage: Coverage::monthlyBudget(50),
            products: [new Product(id: 'prod_x', name: 'X', class: 'fex', carrier: 'X')],
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
            products: [new Product(id: 'prod_x', name: 'X', class: 'fex', carrier: 'X')],
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
            products: [new Product(id: 'prod_x', name: 'X', class: 'fex', carrier: 'X')],
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
                products: [new Product(id: 'prod_x', name: 'X', class: 'fex', carrier: 'X')],
            ))->toWireBody();
            self::assertSame($expectedLastUsed, $body['nicotine_usage']['last_used']);
        }
    }

    public function testWireBodyZipOmittedWhenNull(): void
    {
        $body = (new Input(
            applicant: $this->johnDoeNc(),
            coverage: Coverage::faceValue(25_000),
            products: [new Product(id: 'prod_x', name: 'X', class: 'fex', carrier: 'X')],
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
            products: [new Product(id: 'prod_x', name: 'X', class: 'fex', carrier: 'X')],
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
            products: [new Product(id: 'prod_x', name: 'X', class: 'fex', carrier: 'X')],
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
}
