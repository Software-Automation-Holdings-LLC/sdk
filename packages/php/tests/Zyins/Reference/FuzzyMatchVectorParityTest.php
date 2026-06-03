<?php

declare(strict_types=1);

namespace Isa\Sdk\Tests\Zyins\Reference;

use Isa\Sdk\Zyins\Reference\Internal\DoubleMetaphone;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * Cross-language Double Metaphone parity gate. Asserts the PHP encoder
 * reproduces the primary + alternate code of every term in the shared
 * {@see DoubleMetaphoneVectors} fixture — the same data the TS / Go / C# /
 * Python ports validate against. Any divergence fails the suite.
 */
#[CoversClass(DoubleMetaphone::class)]
final class FuzzyMatchVectorParityTest extends TestCase
{
    /**
     * @return iterable<string, array{0: string, 1: string, 2: string}>
     */
    public static function vectorProvider(): iterable
    {
        foreach (DoubleMetaphoneVectors::all() as [$term, $primary, $alternate]) {
            yield $term => [$term, $primary, $alternate];
        }
    }

    #[DataProvider('vectorProvider')]
    public function testEncoderMatchesVector(string $term, string $expectedPrimary, string $expectedAlternate): void
    {
        [$primary, $alternate] = DoubleMetaphone::encode($term);

        self::assertSame($expectedPrimary, $primary, "primary code diverged for '{$term}'");
        self::assertSame($expectedAlternate, $alternate, "alternate code diverged for '{$term}'");
    }

    public function testFixtureCoversFullVectorSet(): void
    {
        self::assertCount(103, DoubleMetaphoneVectors::all());
    }

    public function testEmptyAndLetterFreeInputYieldEmptyCodes(): void
    {
        self::assertSame(['', ''], DoubleMetaphone::encode(''));
        self::assertSame(['', ''], DoubleMetaphone::encode('123 -- !!'));
    }
}
