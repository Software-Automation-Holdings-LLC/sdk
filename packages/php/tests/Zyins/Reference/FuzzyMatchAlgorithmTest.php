<?php

declare(strict_types=1);

namespace Isa\Sdk\Tests\Zyins\Reference;

use Isa\Sdk\Zyins\Reference\ConceptInterface;
use Isa\Sdk\Zyins\Reference\ConceptKind;
use Isa\Sdk\Zyins\Reference\FuzzyMatchAlgorithm;
use Isa\Sdk\Zyins\Reference\MakeKey;
use Isa\Sdk\Zyins\Reference\MatchAlgorithmInterface;
use Isa\Sdk\Zyins\Reference\Sort;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;

/**
 * Behavioral parity tests for {@see FuzzyMatchAlgorithm} — the tiered
 * cascade (exact → prefix → Damerau → phonetic → synonym), frequency and
 * deterministic tie-break, the never-throw contract, and the four
 * parity-hardening rules. Mirrors the assertions in the TS
 * `FuzzyMatchAlgorithm.test.ts` so the ports agree case-for-case.
 */
#[CoversClass(FuzzyMatchAlgorithm::class)]
final class FuzzyMatchAlgorithmTest extends TestCase
{
    public function testImplementsMatchAlgorithmInterface(): void
    {
        self::assertInstanceOf(MatchAlgorithmInterface::class, new FuzzyMatchAlgorithm());
    }

    public function testEmptyQueryReturnsUnknownWithoutThrowing(): void
    {
        $result = (new FuzzyMatchAlgorithm())->match('  -- ', [self::medication('SERTRALINE', 'Sertraline')]);

        self::assertFalse($result->isKnown());
        self::assertSame(ConceptKind::UNKNOWN, $result->kind());
        self::assertSame('  -- ', $result->inputText());
    }

    public function testNoCandidateMatchReturnsUnknown(): void
    {
        $result = (new FuzzyMatchAlgorithm())->match('zzzzqqqq', [self::medication('SERTRALINE', 'Sertraline')]);

        self::assertFalse($result->isKnown());
        self::assertSame('zzzzqqqq', $result->inputText());
    }

    public function testExactNameMatchWins(): void
    {
        $candidates = [
            self::medication('SERTRALINE', 'Sertraline'),
            self::medication('TYLENOL', 'Tylenol'),
        ];

        self::assertSame('SERTRALINE', (new FuzzyMatchAlgorithm())->match('sertraline', $candidates)->id());
    }

    public function testExactIdMatchWins(): void
    {
        $candidates = [self::medication('TYLENOL', 'Acetaminophen')];

        self::assertSame('TYLENOL', (new FuzzyMatchAlgorithm())->match('tylenol', $candidates)->id());
    }

    public function testDamerauRecoversAdjacentTransposition(): void
    {
        $candidates = [
            self::medication('METFORMIN', 'Metformin'),
            self::medication('LISINOPRIL', 'Lisinopril'),
        ];

        // `metfromin` → `metformin` is one adjacent transposition (OSA
        // distance 1, within the band for a 9-char query).
        self::assertSame('METFORMIN', (new FuzzyMatchAlgorithm())->match('metfromin', $candidates)->id());
    }

    public function testChronsToCrohnsIsNotRecovered(): void
    {
        $candidates = [
            self::condition('CROHNS', 'Crohns'),
            self::condition('COPD', 'COPD'),
        ];

        // Parity property: `chrons` → `crohns` is OSA distance 2 (the H/R/O
        // rotation is not one adjacent swap), which exceeds the ≤1 band for
        // a 6-char query, and the phonetic codes diverge (XRNS vs KRNS). So
        // the matcher returns unknown — identical to the TS reference.
        self::assertFalse((new FuzzyMatchAlgorithm())->match('chrons', $candidates)->isKnown());
    }

    public function testDamerauRecoversDroppedLetter(): void
    {
        $candidates = [self::medication('SERTRALINE', 'Sertraline')];

        // `sertaline` is `sertraline` minus one `r` — one insertion. The
        // phonetic codes legitimately diverge (SRTLN vs SRTRLN), so this is
        // a Damerau-tier win, not a phonetic one.
        self::assertSame('SERTRALINE', (new FuzzyMatchAlgorithm())->match('sertaline', $candidates)->id());
    }

    public function testPhoneticRecoversVowelSwap(): void
    {
        $candidates = [self::medication('TYLENOL', 'Tylenol')];

        // `tylonol` and `tylenol` both encode `TLNL`; two substitutions
        // exceed the short-query Damerau band, so the phonetic tier is what
        // recovers it.
        self::assertSame('TYLENOL', (new FuzzyMatchAlgorithm())->match('tylonol', $candidates)->id());
    }

    public function testExactTierShortCircuitsPrefixTier(): void
    {
        $candidates = [
            self::medication('METFORMIN', 'Metformin'),
            self::medication('METFORMINER', 'Metforminer'),
        ];

        // `metformin` is an exact name hit on the first candidate; the
        // prefix tier (which would also accept the second) never fires
        // because the exact tier is non-empty.
        self::assertSame('METFORMIN', (new FuzzyMatchAlgorithm())->match('metformin', $candidates)->id());
    }

    public function testPrefixTierFiresWhenNoExactHit(): void
    {
        $candidates = [self::medication('LISINOPRIL', 'Lisinopril')];

        // `lisino` is a prefix of `lisinopril`; no exact, so prefix wins.
        self::assertSame('LISINOPRIL', (new FuzzyMatchAlgorithm())->match('lisino', $candidates)->id());
    }

    public function testFrequencyBreaksIntraTierTie(): void
    {
        $candidates = [
            self::condition('HBPA', 'Hbpa'),
            self::condition('HBPB', 'Hbpb'),
        ];
        $frequencies = ['HBPB' => 99, 'HBPA' => 1];

        // Both are Damerau distance 1 from `hbp`; the higher-frequency id wins.
        $matcher = new FuzzyMatchAlgorithm(frequencies: $frequencies);
        self::assertSame('HBPB', $matcher->match('hbp', $candidates)->id());
    }

    public function testDeterministicTieBreakPrefersNameThenId(): void
    {
        // Both are Damerau distance 1 from `alph` with no frequency map; the
        // ids are reverse-ordered from the names to prove NAME is the primary
        // tie-break key, not id. Smaller normalized name ('alpha') wins.
        $candidates = [
            self::condition('AID', 'Alpho'),
            self::condition('ZID', 'Alpha'),
        ];

        $matcher = new FuzzyMatchAlgorithm();
        self::assertSame('ZID', $matcher->match('alph', $candidates)->id());
    }

    public function testIdTieBreakWhenNamesEqual(): void
    {
        // Identical names, distinct ids, no frequency: the smaller id wins.
        $candidates = [
            self::condition('IDB', 'Alpho'),
            self::condition('IDA', 'Alpho'),
        ];

        $matcher = new FuzzyMatchAlgorithm();
        self::assertSame('IDA', $matcher->match('alph', $candidates)->id());
    }

    public function testNfcNormalizationFoldsDecomposedQuery(): void
    {
        // Precomposed candidate name vs decomposed query: both NFC-fold to
        // the same string before phonetic comparison.
        $candidates = [self::medication('CAFE', "Caf\u{00E9}")];          // é precomposed
        $decomposedQuery = "cafe\u{0301}";                                // e + combining acute

        $matcher = new FuzzyMatchAlgorithm();
        // make_key strips both the precomposed and the combining accent, so
        // the query key `CAFE` matches the candidate id `CAFE` exactly. The
        // assertion guards that NFC handling does not corrupt the key path.
        self::assertSame('CAFE', $matcher->match($decomposedQuery, $candidates)->id());
    }

    public function testCloneOverridesFrequenciesWithoutMutatingOriginal(): void
    {
        $candidates = [
            self::condition('HBPA', 'Hbpa'),
            self::condition('HBPB', 'Hbpb'),
        ];
        $base = new FuzzyMatchAlgorithm(frequencies: ['HBPA' => 50], versionTag: 'v1');
        $clone = $base->clone(frequencies: ['HBPB' => 50]);

        self::assertSame('HBPA', $base->match('hbp', $candidates)->id());
        self::assertSame('HBPB', $clone->match('hbp', $candidates)->id());
        self::assertSame('v1', $clone->versionTag, 'versionTag carries through clone');
    }

    public function testEmptyCandidatePoolReturnsUnknown(): void
    {
        $result = (new FuzzyMatchAlgorithm())->match('sertraline', []);

        self::assertFalse($result->isKnown());
    }

    private static function medication(string $id, string $name): ConceptInterface
    {
        return self::concept($id, $name, ConceptKind::MEDICATION);
    }

    private static function condition(string $id, string $name): ConceptInterface
    {
        return self::concept($id, $name, ConceptKind::CONDITION);
    }

    private static function concept(string $id, string $name, string $kind): ConceptInterface
    {
        return new class ($id, $name, $kind) implements ConceptInterface {
            public function __construct(
                private readonly string $conceptId,
                private readonly string $conceptName,
                private readonly string $conceptKind,
            ) {
            }

            public function id(): ?string
            {
                return $this->conceptId;
            }

            public function name(): string
            {
                return $this->conceptName;
            }

            public function kind(): string
            {
                return $this->conceptKind;
            }

            public function isKnown(): bool
            {
                return true;
            }

            public function inputText(): string
            {
                return $this->conceptName;
            }

            public function conditions(string $sort = Sort::MOST_COMMON_FIRST): array
            {
                return [];
            }

            public function medications(string $sort = Sort::MOST_COMMON_FIRST): array
            {
                return [];
            }

            public function equals(ConceptInterface $other): bool
            {
                return $this->conceptKind === $other->kind()
                    && MakeKey::normalize($this->conceptId) === MakeKey::normalize((string) $other->id());
            }
        };
    }
}
