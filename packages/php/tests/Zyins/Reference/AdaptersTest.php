<?php

declare(strict_types=1);

namespace Isa\Sdk\Tests\Zyins\Reference;

use Isa\Sdk\Isa;
use Isa\Sdk\Zyins\Reference\AutocompleteOptions;
use Isa\Sdk\Zyins\Reference\AutocorrectorInterface;
use Isa\Sdk\Zyins\Reference\ConditionRow;
use Isa\Sdk\Zyins\Reference\DatasetBundleV3;
use Isa\Sdk\Zyins\Reference\DefaultAutocompleteAlgorithm;
use Isa\Sdk\Zyins\Reference\DefaultAutocorrector;
use Isa\Sdk\Zyins\Reference\DefaultMatchAlgorithm;
use Isa\Sdk\Zyins\Reference\MedicationRow;
use Isa\Sdk\Zyins\Reference\Reference;
use Isa\Sdk\Zyins\Reference\Relation;
use Isa\Sdk\Zyins\Reference\Sort;
use Isa\Sdk\Zyins\Reference\SpellingCorrectionRow;
use Isa\Sdk\Zyins\Reference\Suggestion;
use Isa\Sdk\Zyins\Reference\SuggestionBucket;
use PHPUnit\Framework\TestCase;

/**
 * Behavioral coverage for the rc.1 → 1.0 reference adapters:
 * Autocorrector (DefaultAutocorrector + bpp2.0-parity guards),
 * MatchAlgorithm (DefaultMatchAlgorithm key-normalize lookup),
 * AutocompleteAlgorithm (DefaultAutocompleteAlgorithm bucket priorities),
 * and the inline-row `DatasetBundleV3::typoMap()` reshape.
 */
final class AdaptersTest extends TestCase
{
    public function testAutocorrectorSubmitModeReplacesTypo(): void
    {
        $ac = new DefaultAutocorrector(typoMap: ['HBP' => 'HIGH BLOOD PRESSURE']);
        self::assertSame('HIGH BLOOD PRESSURE', $ac->correct('hbp', AutocorrectorInterface::MODE_SUBMIT));
    }

    public function testAutocorrectorKeyupGuardPreventsMidTypingCompletion(): void
    {
        $ac = new DefaultAutocorrector(typoMap: ['ASTHM' => 'ASTHMA']);
        self::assertSame('ASTHM', $ac->correct('asthm', AutocorrectorInterface::MODE_KEYUP));
    }

    public function testAutocorrectorSubmitGuardPreventsDuplication(): void
    {
        $ac = new DefaultAutocorrector(typoMap: ['CHOLESTEROL' => 'HIGH CHOLESTEROL']);
        self::assertSame('HIGH CHOLESTEROL', $ac->correct('high cholesterol', AutocorrectorInterface::MODE_SUBMIT));
    }

    public function testAutocorrectorPreservesTrailingWhitespace(): void
    {
        $ac = new DefaultAutocorrector(typoMap: ['HBP' => 'HIGH BLOOD PRESSURE']);
        self::assertSame('HIGH BLOOD PRESSURE ', $ac->correct('hbp ', AutocorrectorInterface::MODE_SUBMIT));
    }

    public function testAutocorrectorEmitsOnAppliedEvent(): void
    {
        $captured = null;
        $ac = new DefaultAutocorrector(
            typoMap: ['HBP' => 'HIGH BLOOD PRESSURE'],
            onApplied: function ($event) use (&$captured): void {
                $captured = $event;
            },
        );
        $ac->correct('hbp', AutocorrectorInterface::MODE_SUBMIT);
        self::assertNotNull($captured);
        self::assertSame('HBP', $captured->from);
        self::assertSame('HIGH BLOOD PRESSURE', $captured->to);
    }

    public function testIsaAutocorrectorFactoryConstructsDefault(): void
    {
        $ac = Isa::autocorrector()->create(['HBP' => 'HIGH BLOOD PRESSURE']);
        self::assertInstanceOf(DefaultAutocorrector::class, $ac);
        self::assertSame('HIGH BLOOD PRESSURE', $ac->correct('hbp', AutocorrectorInterface::MODE_SUBMIT));
    }

    public function testTypoMapDerivesFromSpellingCorrectionRows(): void
    {
        $bundle = new DatasetBundleV3(
            version: '3.0',
            medications: [],
            conditions: [],
            products: [],
            nicotineOptions: [],
            spellingCorrections: [
                new SpellingCorrectionRow(id: 'spl_1', from: 'HYPRTENSION', to: 'HYPERTENSION'),
                new SpellingCorrectionRow(id: 'spl_2', from: 'HOSPITILIZED', to: 'HOSPITALIZED'),
            ],
            datasets: [],
        );
        self::assertSame(
            ['HYPRTENSION' => 'HYPERTENSION', 'HOSPITILIZED' => 'HOSPITALIZED'],
            $bundle->typoMap(),
        );
    }

    public function testDefaultMatchAlgorithmExactKeyLookup(): void
    {
        $algo = new DefaultMatchAlgorithm();
        $bundle = self::tinyBundle();
        $reference = new Reference(matchAlgorithm: $algo);
        $hit = $reference->conditions->match('high blood pressure', $bundle);
        self::assertTrue($hit->isKnown());
        self::assertSame('HIGHBLOODPRESSURE', $hit->id());
    }

    public function testDefaultMatchAlgorithmReturnsUnknownOnMiss(): void
    {
        $algo = new DefaultMatchAlgorithm();
        $hit = $algo->match('totally-unknown', []);
        self::assertFalse($hit->isKnown());
        self::assertSame('totally-unknown', $hit->inputText());
    }

    public function testAutocompleteStartsWithBucketRanksFirst(): void
    {
        $bundle = self::tinyBundle();
        $reference = new Reference();
        $suggestions = $reference->conditions->autocomplete(
            'high',
            new AutocompleteOptions(limit: 10),
            $bundle,
        );
        self::assertNotEmpty($suggestions);
        self::assertInstanceOf(Suggestion::class, $suggestions[0]);
        self::assertSame(SuggestionBucket::STARTS_WITH, $suggestions[0]->bucket);
        self::assertSame('HIGHBLOODPRESSURE', $suggestions[0]->id());
    }

    public function testAutocompleteRespectsLimit(): void
    {
        $bundle = self::tinyBundle();
        $reference = new Reference();
        $suggestions = $reference->conditions->autocomplete(
            'h',
            new AutocompleteOptions(limit: 1),
            $bundle,
        );
        self::assertCount(1, $suggestions);
    }

    public function testAutocompleteAlgorithmEmptyQueryReturnsEmpty(): void
    {
        $algo = new DefaultAutocompleteAlgorithm();
        self::assertSame([], $algo->rank('', [], new AutocompleteOptions()));
    }

    public function testAutocompleteAlphabeticalIgnoresFrequencyAndFlattensBuckets(): void
    {
        // B2: ALPHABETICAL keeps the relevance FILTER but emits matches
        // A→Z, frequency-blind, across every bucket. "pressure" matches
        // all three; the high frequency on "High Blood Pressure" must NOT
        // reorder them.
        $bundle = self::pressureBundle();
        $reference = new Reference();
        $suggestions = $reference->conditions->autocomplete(
            'pressure',
            new AutocompleteOptions(limit: 10, sort: Sort::ALPHABETICAL),
            $bundle,
        );
        $names = array_map(static fn (Suggestion $s): string => $s->name(), $suggestions);
        self::assertSame(
            ['Blood Pressure Cuff', 'High Blood Pressure', 'Low Blood Pressure'],
            $names,
        );
    }

    public function testAutocompleteAlphabeticalCarriesFrequencyScore(): void
    {
        // coderabbit parity: ALPHABETICAL mode collapses every bucket into
        // one group (scaleFactor 1), so each suggestion's score is
        // (frequency + 1) — NOT 0. This matches the TS/Python mirrors, which
        // run computeScoreLookup unconditionally so consumers comparing
        // `score` see the catalog frequency signal even in A→Z order.
        $bundle = self::pressureBundle();
        $reference = new Reference();
        $suggestions = $reference->conditions->autocomplete(
            'pressure',
            new AutocompleteOptions(
                limit: 10,
                sort: Sort::ALPHABETICAL,
                frequencies: ['HIGHBLOODPRESSURE' => 4500],
            ),
            $bundle,
        );
        $byId = [];
        foreach ($suggestions as $s) {
            $byId[$s->id()] = $s->score;
        }
        self::assertSame(4501, $byId['HIGHBLOODPRESSURE']); // 4500 + 1
        self::assertSame(1, $byId['LOWBLOODPRESSURE']);     // 0 + 1
        self::assertSame(1, $byId['BLOODPRESSURECUFF']);    // 0 + 1
    }

    public function testAutocompleteDefaultSortKeepsFrequencyOrder(): void
    {
        // Default (omitted sort) keeps frequency order — proves Alphabetical
        // is opt-in. "High Blood Pressure" carries the highest frequency.
        $bundle = self::pressureBundle();
        $reference = new Reference();
        $suggestions = $reference->conditions->autocomplete(
            'pressure',
            new AutocompleteOptions(limit: 10),
            $bundle,
        );
        self::assertNotEmpty($suggestions);
        self::assertSame('HIGHBLOODPRESSURE', $suggestions[0]->id());
    }

    private static function pressureBundle(): DatasetBundleV3
    {
        // Frequency seeded from treatedWith counts: HIGHBLOODPRESSURE high,
        // the others zero — so MostCommonFirst and A→Z differ observably.
        $conditions = [
            new ConditionRow(
                id: 'HIGHBLOODPRESSURE',
                name: 'High Blood Pressure',
                treatedWith: [new Relation(id: 'LISINOPRIL', name: 'Lisinopril', prescriptionCount: 9000)],
            ),
            new ConditionRow(id: 'LOWBLOODPRESSURE', name: 'Low Blood Pressure', treatedWith: []),
            new ConditionRow(id: 'BLOODPRESSURECUFF', name: 'Blood Pressure Cuff', treatedWith: []),
        ];
        return new DatasetBundleV3(
            version: '3.0',
            medications: [],
            conditions: $conditions,
            products: [],
            nicotineOptions: [],
            spellingCorrections: [],
            datasets: [],
        );
    }

    private static function tinyBundle(): DatasetBundleV3
    {
        $conditions = [
            new ConditionRow(
                id: 'HIGHBLOODPRESSURE',
                name: 'High blood pressure',
                treatedWith: [new Relation(id: 'LISINOPRIL', name: 'Lisinopril', prescriptionCount: 100)],
            ),
            new ConditionRow(id: 'HEADACHE', name: 'Headache', treatedWith: []),
        ];
        $medications = [
            new MedicationRow(
                id: 'LISINOPRIL',
                name: 'Lisinopril',
                usedFor: [new Relation(id: 'HIGHBLOODPRESSURE', name: 'High blood pressure', prescriptionCount: 100)],
            ),
        ];
        return new DatasetBundleV3(
            version: '3.0',
            medications: $medications,
            conditions: $conditions,
            products: [],
            nicotineOptions: [],
            spellingCorrections: [],
            datasets: [],
        );
    }
}
