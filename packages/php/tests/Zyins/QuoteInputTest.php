<?php

declare(strict_types=1);

namespace Sah\Sdk\Tests\Zyins;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use Sah\Sdk\Zyins\Applicant;
use Sah\Sdk\Zyins\Coverage;
use Sah\Sdk\Zyins\Height;
use Sah\Sdk\Zyins\NicotineDuration;
use Sah\Sdk\Zyins\NicotineUsageInput;
use Sah\Sdk\Zyins\Product;
use Sah\Sdk\Zyins\ProductType;
use Sah\Sdk\Zyins\Quote\Input;
use Sah\Sdk\Zyins\Sex;
use Sah\Sdk\Zyins\Weight;

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
