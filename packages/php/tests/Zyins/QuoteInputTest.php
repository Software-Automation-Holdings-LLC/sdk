<?php

declare(strict_types=1);

namespace Isa\Sdk\Tests\Zyins;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use Isa\Sdk\Zyins\Applicant;
use Isa\Sdk\Zyins\Coverage;
use Isa\Sdk\Zyins\Height;
use Isa\Sdk\Zyins\NicotineDuration;
use Isa\Sdk\Zyins\NicotineUsageInput;
use Isa\Sdk\Zyins\Product;
use Isa\Sdk\Zyins\ProductType;
use Isa\Sdk\Zyins\Quote\Input;
use Isa\Sdk\Zyins\Sex;
use Isa\Sdk\Zyins\Weight;

#[CoversClass(Input::class)]
final class QuoteInputTest extends TestCase
{
    public function testWireBodyAcceptsStructuredNicotineUsage(): void
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
            product: new Product('x', ProductType::FinalExpense, 'tok', 'X'),
        ))->toWireBody();

        self::assertSame('current', $body['applicant']['nicotine_use']);
    }
}
