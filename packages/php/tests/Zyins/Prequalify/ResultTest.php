<?php

declare(strict_types=1);

namespace Isa\Sdk\Tests\Zyins\Prequalify;

use Isa\Sdk\Zyins\Prequalify\Result;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;

#[CoversClass(Result::class)]
final class ResultTest extends TestCase
{
    public function testExtractMonthlyPremiumFallsBackToFirstArrayTierWhenDefaultIsMalformed(): void
    {
        $result = Result::fromWire([
            'results' => [
                'default' => [
                    [
                        'brand' => 'colonial-penn',
                        'plan' => 'preferred-plus',
                        'death_benefit' => 25000,
                        'id' => 'prod_cp_fixture',
                        // `default` tier is a non-array scalar; the graded tier
                        // is the first array-valued entry in the pricing map.
                        'pricing' => [
                            'default' => 'not-a-tier',
                            'graded' => ['monthly' => '42.10'],
                        ],
                    ],
                ],
            ],
        ]);

        self::assertCount(1, $result->plans);
        self::assertSame(42.10, $result->plans[0]->monthlyPremium);
    }
}
