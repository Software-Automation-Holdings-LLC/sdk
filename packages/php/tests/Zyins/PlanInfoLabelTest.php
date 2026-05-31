<?php

declare(strict_types=1);

namespace Isa\Sdk\Tests\Zyins;

use InvalidArgumentException;
use PHPUnit\Framework\TestCase;
use Isa\Sdk\Zyins\PlanInfoItem;
use Isa\Sdk\Zyins\PlanInfoLabel;

/**
 * Tests for the typed plan-info surface + Title Case label derivation.
 * Mirrors packages/python/tests/zyins/test_plan_info_label.py and
 * packages/go/zyins/plan_info_test.go.
 */
final class PlanInfoLabelTest extends TestCase
{
    /**
     * @dataProvider specialAcronymsProvider
     */
    public function testTitleCaseSpecialAcronyms(string $key, string $expected): void
    {
        self::assertSame($expected, PlanInfoLabel::titleCase($key));
    }

    public static function specialAcronymsProvider(): array
    {
        return [
            ['eapp', 'eApp'],
            ['EApp', 'eApp'],
            ['EAPP', 'eApp'],
            ['url', 'URL'],
            ['pdf', 'PDF'],
            ['api', 'API'],
            ['ssn', 'SSN'],
            ['ach', 'ACH'],
            ['eft', 'EFT'],
            ['id', 'ID'],
            ['faq', 'FAQ'],
        ];
    }

    /**
     * @dataProvider genericKeysProvider
     */
    public function testTitleCaseGeneric(string $key, string $expected): void
    {
        self::assertSame($expected, PlanInfoLabel::titleCase($key));
    }

    public static function genericKeysProvider(): array
    {
        return [
            ['rate_class', 'Rate Class'],
            ['rate_class_notes', 'Rate Class Notes'],
            ['telesales', 'Telesales'],
            ['max-issue-age', 'Max Issue Age'],
            ['face_amount_max', 'Face Amount Max'],
        ];
    }

    public function testTitleCaseSpecialTokenInsideCompoundKey(): void
    {
        self::assertSame('API URL', PlanInfoLabel::titleCase('api_url'));
        self::assertSame('eApp Telesales', PlanInfoLabel::titleCase('eapp_telesales'));
        self::assertSame('Submit PDF', PlanInfoLabel::titleCase('submit_pdf'));
    }

    public function testTitleCaseEmptyString(): void
    {
        self::assertSame('', PlanInfoLabel::titleCase(''));
    }

    public function testTitleCaseConsecutiveSeparatorsCollapse(): void
    {
        self::assertSame('Foo Bar', PlanInfoLabel::titleCase('foo__bar'));
        self::assertSame('Foo Bar', PlanInfoLabel::titleCase('foo--bar'));
        self::assertSame('Foo Bar', PlanInfoLabel::titleCase('foo_-bar'));
    }

    public function testPlanInfoItemConstruction(): void
    {
        $item = new PlanInfoItem('eapp', 'eApp', ['yes']);
        self::assertSame('eapp', $item->key);
        self::assertSame('eApp', $item->label);
        self::assertSame(['yes'], $item->values);
    }

    public function testPlanInfoItemEmptyKeyRejected(): void
    {
        $this->expectException(InvalidArgumentException::class);
        new PlanInfoItem('', 'X', []);
    }

    public function testCoerceTypedArrayUsedVerbatim(): void
    {
        $items = PlanInfoLabel::coerce([
            ['key' => 'eapp', 'label' => 'eApp', 'values' => ['yes']],
            ['key' => 'telesales', 'label' => 'Telesales', 'values' => ['no']],
        ]);
        self::assertCount(2, $items);
        self::assertSame('eapp', $items[0]->key);
        self::assertSame('eApp', $items[0]->label);
        self::assertSame(['yes'], $items[0]->values);
        self::assertSame('telesales', $items[1]->key);
    }

    public function testCoerceTypedArraySynthesizesLabelWhenMissing(): void
    {
        $items = PlanInfoLabel::coerce([
            ['key' => 'rate_class_notes', 'values' => ['A']],
        ]);
        self::assertSame('Rate Class Notes', $items[0]->label);
    }

    public function testCoerceTypedArraySkipsEntriesWithoutKey(): void
    {
        $items = PlanInfoLabel::coerce([
            ['label' => 'Orphan', 'values' => []],
            ['key' => 'eapp', 'values' => []],
        ]);
        self::assertCount(1, $items);
        self::assertSame('eapp', $items[0]->key);
    }

    public function testCoerceLegacyMapUpconverts(): void
    {
        $items = PlanInfoLabel::coerce([
            'eapp'       => ['yes'],
            'rate_class' => ['preferred'],
        ]);
        self::assertCount(2, $items);
        $labels = [];
        foreach ($items as $item) {
            $labels[$item->key] = $item->label;
        }
        self::assertSame('eApp', $labels['eapp']);
        self::assertSame('Rate Class', $labels['rate_class']);
    }

    public function testCoerceUnknownShapeReturnsEmptyArray(): void
    {
        self::assertSame([], PlanInfoLabel::coerce(null));
        self::assertSame([], PlanInfoLabel::coerce('string'));
        self::assertSame([], PlanInfoLabel::coerce(42));
    }

    public function testCoerceNonStringValuesAreDropped(): void
    {
        $items = PlanInfoLabel::coerce([
            ['key' => 'eapp', 'values' => ['yes', 42, null, 'no']],
        ]);
        self::assertSame(['yes', 'no'], $items[0]->values);
    }

    public function testCoerceWireOrderPreserved(): void
    {
        $items = PlanInfoLabel::coerce([
            ['key' => 'z', 'values' => []],
            ['key' => 'a', 'values' => []],
            ['key' => 'm', 'values' => []],
        ]);
        $keys = array_map(fn ($i) => $i->key, $items);
        self::assertSame(['z', 'a', 'm'], $keys);
    }
}
