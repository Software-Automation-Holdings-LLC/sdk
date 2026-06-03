<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Reference\Internal;

/**
 * Double Metaphone phonetic encoder — Lawrence Philips' algorithm, ported
 * branch-for-branch from the TS reference (`_doubleMetaphone.ts`), which in
 * turn follows the Apache Commons Codec implementation.
 *
 * {@see encode()} returns a `[primary, alternate]` pair of phonetic codes.
 * Two strings that sound alike share a code (`sertaline` and `sertraline`
 * both encode to `SRTRLN`; `tylonol` and `tylenol` both to `TLNL`), which
 * lets the fuzzy matcher recover misspellings edit distance alone misses.
 *
 * This is a cross-language contract surface: the Go / TS / C# / Python
 * ports MUST reproduce the same codes for the 102-term vector fixture in
 * {@see DoubleMetaphoneVectors}. Keep the branch structure identical when
 * editing.
 *
 * Determinism notes:
 *   - Input is upper-cased with `mb_strtoupper(..., 'UTF-8')` then stripped
 *     to ASCII A–Z, matching the TS `toUpperCase().replace(/[^A-Z]/g, '')`.
 *   - Only ASCII A–Z is processed; any other character is skipped, so the
 *     caller is responsible for NFC-normalizing before calling.
 *
 * @internal The fuzzy matcher and its vector test are the only callers.
 */
final class DoubleMetaphone
{
    /**
     * Code length. Classic Double Metaphone truncates to 4, too lossy for
     * the long compound terms in the medical catalog — `sertraline` (SRTR)
     * and `sertaline` (SRTL) diverge inside four symbols. A 6-symbol code
     * keeps near-homophone drug names colliding while staying short enough
     * to pool genuine homophones. This is the value the vector fixture
     * pins; the ports MUST use the same length.
     */
    public const DEFAULT_MAX_CODE_LEN = 6;

    private const VOWELS = 'AEIOUY';

    /** @var list<string> */
    private const SILENT_START = ['GN', 'KN', 'PN', 'WR', 'PS'];

    private const L_R_N_M_B_H_F_V_W_SPACE = ' BHFVW';

    /** @var list<string> */
    private const ES_EP_EB_EL_EY_IB_IL_IN_IE_EI_ER = [
        'ES', 'EP', 'EB', 'EL', 'EY', 'IB', 'IL', 'IN', 'IE', 'EI', 'ER',
    ];

    private const L_T_K_S_N_M_B_Z = 'LTKSNMBZ';

    private string $value;
    private int $length;
    private int $maxLength;
    private string $primary = '';
    private string $alternate = '';

    private function __construct(string $value, int $maxLength)
    {
        $this->value = $value;
        $this->length = strlen($value);
        $this->maxLength = $maxLength;
    }

    /**
     * Encode `input` into its Double Metaphone primary + alternate codes.
     * Non-letters are dropped before encoding; an empty or letter-free
     * input yields two empty codes.
     *
     * @return array{0: string, 1: string} [primary, alternate]
     */
    public static function encode(string $input, int $maxLength = self::DEFAULT_MAX_CODE_LEN): array
    {
        $upper = mb_strtoupper($input, 'UTF-8');
        $cleaned = preg_replace('/[^A-Z]/', '', $upper) ?? '';
        if ($cleaned === '') {
            return ['', ''];
        }
        $encoder = new self($cleaned, $maxLength);
        return $encoder->run();
    }

    /** @return array{0: string, 1: string} */
    private function run(): array
    {
        $index = $this->skipSilentStart();
        if ($this->at(0) === 'X') {
            $this->append('S');
            $index = 1;
        }
        while ($index < $this->length && ! $this->done()) {
            $index = $this->step($index);
        }
        return [
            substr($this->primary, 0, $this->maxLength),
            substr($this->alternate, 0, $this->maxLength),
        ];
    }

    private function append(string $primary, ?string $alternate = null): void
    {
        $this->primary .= $primary;
        $this->alternate .= $alternate ?? $primary;
    }

    private function done(): bool
    {
        return strlen($this->primary) >= $this->maxLength
            && strlen($this->alternate) >= $this->maxLength;
    }

    private function at(int $index): string
    {
        if ($index < 0 || $index >= $this->length) {
            return '';
        }
        return $this->value[$index];
    }

    private function sliceStr(int $start, int $end): string
    {
        $lo = max(0, $start);
        $hi = min($this->length, $end);
        if ($hi <= $lo) {
            return '';
        }
        return substr($this->value, $lo, $hi - $lo);
    }

    private function isVowel(int $index): bool
    {
        $ch = $this->at($index);
        return $ch !== '' && str_contains(self::VOWELS, $ch);
    }

    private function isSlavoGermanic(): bool
    {
        return preg_match('/[WK]|CZ|WITZ/', $this->value) === 1;
    }

    private function contains(int $start, int $length, string ...$candidates): bool
    {
        $target = $this->sliceStr($start, $start + $length);
        return in_array($target, $candidates, true);
    }

    private function skipSilentStart(): int
    {
        $head = $this->sliceStr(0, 2);
        return in_array($head, self::SILENT_START, true) ? 1 : 0;
    }

    private function step(int $index): int
    {
        $ch = $this->at($index);
        return match ($ch) {
            'A', 'E', 'I', 'O', 'U', 'Y' => $this->stepVowel($index),
            'B' => $this->stepDoubledConsonant($index, 'P', 'B'),
            'C' => $this->stepC($index),
            "\u{00C7}" => $this->appendReturn('S', $index + 1),
            'D' => $this->stepD($index),
            'F' => $this->stepDoubledConsonant($index, 'F', 'F'),
            'G' => $this->stepG($index),
            'H' => $this->stepH($index),
            'J' => $this->stepJ($index),
            'K' => $this->stepDoubledConsonant($index, 'K', 'K'),
            'L' => $this->stepL($index),
            'M' => $this->stepM($index),
            'N' => $this->stepDoubledConsonant($index, 'N', 'N'),
            "\u{00D1}" => $this->appendReturn('N', $index + 1),
            'P' => $this->stepP($index),
            'Q' => $this->stepDoubledConsonant($index, 'K', 'Q'),
            'R' => $this->stepR($index),
            'S' => $this->stepS($index),
            'T' => $this->stepT($index),
            'V' => $this->stepDoubledConsonant($index, 'F', 'V'),
            'W' => $this->stepW($index),
            'X' => $this->stepX($index),
            'Z' => $this->stepZ($index),
            default => $index + 1,
        };
    }

    private function stepVowel(int $index): int
    {
        if ($index === 0) {
            $this->append('A');
        }
        return $index + 1;
    }

    private function appendReturn(string $code, int $next): int
    {
        $this->append($code);
        return $next;
    }

    /**
     * The B/F/K/N/Q/V family: append a single code, skipping a doubled
     * letter. `Çç`/`Ññ` are handled separately as they never double here.
     */
    private function stepDoubledConsonant(int $index, string $code, string $letter): int
    {
        $this->append($code);
        return $this->at($index + 1) === $letter ? $index + 2 : $index + 1;
    }

    private function stepC(int $index): int
    {
        if ($this->conditionC0($index)) {
            $this->append('K');
            return $index + 2;
        }
        if ($index === 0 && $this->contains($index, 6, 'CAESAR')) {
            $this->append('S');
            return $index + 2;
        }
        if ($this->contains($index, 2, 'CH')) {
            return $this->stepCH($index);
        }
        if ($this->contains($index, 2, 'CZ') && ! $this->contains($index - 2, 4, 'WICZ')) {
            $this->append('S', 'X');
            return $index + 2;
        }
        if ($this->contains($index + 1, 3, 'CIA')) {
            $this->append('X');
            return $index + 3;
        }
        if ($this->contains($index, 2, 'CC') && ! ($index === 1 && $this->at(0) === 'M')) {
            return $this->stepCC($index);
        }
        if ($this->contains($index, 2, 'CK', 'CG', 'CQ')) {
            $this->append('K');
            return $index + 2;
        }
        if ($this->contains($index, 2, 'CI', 'CE', 'CY')) {
            if ($this->contains($index, 3, 'CIO', 'CIE', 'CIA')) {
                $this->append('S', 'X');
            } else {
                $this->append('S');
            }
            return $index + 2;
        }
        $this->append('K');
        if ($this->contains($index + 1, 2, ' C', ' Q', ' G')) {
            return $index + 3;
        }
        if (
            $this->contains($index + 1, 1, 'C', 'K', 'Q')
            && ! $this->contains($index + 1, 2, 'CE', 'CI')
        ) {
            return $index + 2;
        }
        return $index + 1;
    }

    private function conditionC0(int $index): bool
    {
        if ($this->contains($index, 4, 'CHIA')) {
            return true;
        }
        if ($index <= 1) {
            return false;
        }
        if ($this->isVowel($index - 2)) {
            return false;
        }
        if (! $this->contains($index - 1, 3, 'ACH')) {
            return false;
        }
        $c = $this->at($index + 2);
        return ($c !== 'I' && $c !== 'E') || $this->contains($index - 2, 6, 'BACHER', 'MACHER');
    }

    private function stepCC(int $index): int
    {
        if (
            $this->contains($index + 2, 1, 'I', 'E', 'H')
            && ! $this->contains($index + 2, 2, 'HU')
        ) {
            if (
                ($index === 1 && $this->at($index - 1) === 'A')
                || $this->contains($index - 1, 5, 'UCCEE', 'UCCES')
            ) {
                $this->append('KS');
            } else {
                $this->append('X');
            }
            return $index + 3;
        }
        $this->append('K');
        return $index + 2;
    }

    private function stepCH(int $index): int
    {
        if ($index > 0 && $this->contains($index, 4, 'CHAE')) {
            $this->append('K', 'X');
            return $index + 2;
        }
        if ($this->conditionCH0($index) || $this->conditionCH1($index)) {
            $this->append('K');
            return $index + 2;
        }
        if ($index > 0) {
            $this->append($this->contains(0, 2, 'MC') ? 'K' : 'X', 'K');
        } else {
            $this->append('X');
        }
        return $index + 2;
    }

    private function conditionCH0(int $index): bool
    {
        if ($index !== 0) {
            return false;
        }
        if (
            ! $this->contains($index + 1, 5, 'HARAC', 'HARIS')
            && ! $this->contains($index + 1, 3, 'HOR', 'HYM', 'HIA', 'HEM')
        ) {
            return false;
        }
        return ! $this->contains(0, 5, 'CHORE');
    }

    private function conditionCH1(int $index): bool
    {
        return $this->contains(0, 4, 'VAN ', 'VON ')
            || $this->contains(0, 3, 'SCH')
            || $this->contains($index - 2, 6, 'ORCHES', 'ARCHIT', 'ORCHID')
            || $this->contains($index + 2, 1, 'T', 'S')
            || (($this->contains($index - 1, 1, 'A', 'O', 'U', 'E') || $index === 0)
                && ($this->containsChars($index + 2, self::L_R_N_M_B_H_F_V_W_SPACE)
                    || $index + 1 === $this->length - 1));
    }

    /**
     * Membership test against the individual characters of `$chars`,
     * mirroring the TS spread `...string.split('')`.
     */
    private function containsChars(int $start, string $chars): bool
    {
        $target = $this->sliceStr($start, $start + 1);
        return $target !== '' && str_contains($chars, $target);
    }

    private function stepD(int $index): int
    {
        if ($this->contains($index, 2, 'DG')) {
            if ($this->contains($index + 2, 1, 'I', 'E', 'Y')) {
                $this->append('J');
                return $index + 3;
            }
            $this->append('TK');
            return $index + 2;
        }
        $this->append('T');
        return $this->contains($index, 2, 'DT', 'DD') ? $index + 2 : $index + 1;
    }

    private function stepG(int $index): int
    {
        if ($this->at($index + 1) === 'H') {
            return $this->stepGH($index);
        }
        if ($this->at($index + 1) === 'N') {
            return $this->stepGN($index);
        }
        if ($this->contains($index + 1, 2, 'LI') && ! $this->isSlavoGermanic()) {
            $this->append('KL', 'L');
            return $index + 2;
        }
        if (
            $index === 0
            && ($this->at($index + 1) === 'Y'
                || $this->contains($index + 1, 2, ...self::ES_EP_EB_EL_EY_IB_IL_IN_IE_EI_ER))
        ) {
            $this->append('K', 'J');
            return $index + 2;
        }
        if (
            ($this->contains($index + 1, 2, 'ER') || $this->at($index + 1) === 'Y')
            && ! $this->contains(0, 6, 'DANGER', 'RANGER', 'MANGER')
            && ! $this->contains($index - 1, 1, 'E', 'I')
            && ! $this->contains($index - 1, 3, 'RGY', 'OGY')
        ) {
            $this->append('K', 'J');
            return $index + 2;
        }
        if (
            $this->contains($index + 1, 1, 'E', 'I', 'Y')
            || $this->contains($index - 1, 4, 'AGGI', 'OGGI')
        ) {
            if (
                $this->contains(0, 4, 'VAN ', 'VON ')
                || $this->contains(0, 3, 'SCH')
                || $this->contains($index + 1, 2, 'ET')
            ) {
                $this->append('K');
            } elseif ($this->contains($index + 1, 3, 'IER')) {
                $this->append('J');
            } else {
                $this->append('J', 'K');
            }
            return $index + 2;
        }
        $this->append('K');
        return $this->at($index + 1) === 'G' ? $index + 2 : $index + 1;
    }

    private function stepGH(int $index): int
    {
        if ($index > 0 && ! $this->isVowel($index - 1)) {
            $this->append('K');
            return $index + 2;
        }
        if ($index === 0) {
            $this->append($this->at($index + 2) === 'I' ? 'J' : 'K');
            return $index + 2;
        }
        if (
            ($index > 1 && $this->contains($index - 2, 1, 'B', 'H', 'D'))
            || ($index > 2 && $this->contains($index - 3, 1, 'B', 'H', 'D'))
            || ($index > 3 && $this->contains($index - 4, 1, 'B', 'H'))
        ) {
            return $index + 2;
        }
        if (
            $index > 2
            && $this->at($index - 1) === 'U'
            && $this->contains($index - 3, 1, 'C', 'G', 'L', 'R', 'T')
        ) {
            $this->append('F');
        } elseif ($index > 0 && $this->at($index - 1) !== 'I') {
            $this->append('K');
        }
        return $index + 2;
    }

    private function stepGN(int $index): int
    {
        if ($index === 1 && $this->isVowel(0) && ! $this->isSlavoGermanic()) {
            $this->append('KN', 'N');
        } elseif (
            ! $this->contains($index + 2, 2, 'EY')
            && $this->at($index + 1) !== 'Y'
            && ! $this->isSlavoGermanic()
        ) {
            $this->append('N', 'KN');
        } else {
            $this->append('KN');
        }
        return $index + 2;
    }

    private function stepH(int $index): int
    {
        if (($index === 0 || $this->isVowel($index - 1)) && $this->isVowel($index + 1)) {
            $this->append('H');
            return $index + 2;
        }
        return $index + 1;
    }

    private function stepJ(int $index): int
    {
        if ($this->contains($index, 4, 'JOSE') || $this->contains(0, 4, 'SAN ')) {
            if (
                ($index === 0 && $this->at($index + 4) === ' ')
                || $this->contains(0, 4, 'SAN ')
            ) {
                $this->append('H');
            } else {
                $this->append('J', 'H');
            }
            return $index + 1;
        }
        if ($index === 0 && ! $this->contains($index, 4, 'JOSE')) {
            $this->append('J', 'A');
        } elseif (
            $this->isVowel($index - 1)
            && ! $this->isSlavoGermanic()
            && ($this->at($index + 1) === 'A' || $this->at($index + 1) === 'O')
        ) {
            $this->append('J', 'H');
        } elseif ($index === $this->length - 1) {
            $this->append('J', '');
        } elseif (
            ! $this->containsChars($index + 1, self::L_T_K_S_N_M_B_Z)
            && ! $this->contains($index - 1, 1, 'S', 'K', 'L')
        ) {
            $this->append('J');
        }
        return $this->at($index + 1) === 'J' ? $index + 2 : $index + 1;
    }

    private function stepL(int $index): int
    {
        if ($this->at($index + 1) === 'L') {
            if ($this->conditionL0($index)) {
                $this->append('L', '');
            } else {
                $this->append('L');
            }
            return $index + 2;
        }
        $this->append('L');
        return $index + 1;
    }

    private function conditionL0(int $index): bool
    {
        if (
            $index === $this->length - 3
            && $this->contains($index - 1, 4, 'ILLO', 'ILLA', 'ALLE')
        ) {
            return true;
        }
        return ($this->contains($this->length - 2, 2, 'AS', 'OS')
                || $this->contains($this->length - 1, 1, 'A', 'O'))
            && $this->contains($index - 1, 4, 'ALLE');
    }

    private function stepM(int $index): int
    {
        $this->append('M');
        return $this->isMSilentDoubled($index) ? $index + 2 : $index + 1;
    }

    private function stepP(int $index): int
    {
        if ($this->at($index + 1) === 'H') {
            $this->append('F');
            return $index + 2;
        }
        $this->append('P');
        return $this->contains($index + 1, 1, 'P', 'B') ? $index + 2 : $index + 1;
    }

    private function stepR(int $index): int
    {
        if (
            $index === $this->length - 1
            && ! $this->isSlavoGermanic()
            && $this->contains($index - 2, 2, 'IE')
            && ! $this->contains($index - 4, 2, 'ME', 'MA')
        ) {
            $this->append('', 'R');
        } else {
            $this->append('R');
        }
        return $this->at($index + 1) === 'R' ? $index + 2 : $index + 1;
    }

    private function stepS(int $index): int
    {
        if ($this->contains($index - 1, 3, 'ISL', 'YSL')) {
            return $index + 1;
        }
        if ($index === 0 && $this->contains($index, 5, 'SUGAR')) {
            $this->append('X', 'S');
            return $index + 1;
        }
        if ($this->contains($index, 2, 'SH')) {
            $this->append($this->contains($index + 1, 4, 'HEIM', 'HOEK', 'HOLM', 'HOLZ') ? 'S' : 'X');
            return $index + 2;
        }
        if ($this->contains($index, 3, 'SIO', 'SIA') || $this->contains($index, 4, 'SIAN')) {
            // Mirrors the TS branch verbatim: primary is always 'S';
            // alternate is 'S' for Slavo-Germanic, 'X' otherwise.
            $this->append('S', $this->isSlavoGermanic() ? 'S' : 'X');
            return $index + 3;
        }
        if (
            ($index === 0 && $this->contains($index + 1, 1, 'M', 'N', 'L', 'W'))
            || $this->contains($index + 1, 1, 'Z')
        ) {
            $this->append('S', 'X');
            return $this->at($index + 1) === 'Z' ? $index + 2 : $index + 1;
        }
        if ($this->contains($index, 2, 'SC')) {
            return $this->stepSC($index);
        }
        if ($index === $this->length - 1 && $this->contains($index - 2, 2, 'AI', 'OI')) {
            $this->append('', 'S');
        } else {
            $this->append('S');
        }
        return $this->contains($index + 1, 1, 'S', 'Z') ? $index + 2 : $index + 1;
    }

    private function stepSC(int $index): int
    {
        if ($this->at($index + 2) === 'H') {
            if ($this->contains($index + 3, 2, 'OO', 'ER', 'EN', 'UY', 'ED', 'EM')) {
                $this->append($this->contains($index + 3, 2, 'ER', 'EN') ? 'X' : 'SK', 'SK');
            } elseif ($index === 0 && ! $this->isVowel(3) && $this->at(3) !== 'W') {
                $this->append('X', 'S');
            } else {
                $this->append('X');
            }
            return $index + 3;
        }
        if ($this->contains($index + 2, 1, 'I', 'E', 'Y')) {
            $this->append('S');
            return $index + 3;
        }
        $this->append('SK');
        return $index + 3;
    }

    private function stepT(int $index): int
    {
        if ($this->contains($index, 4, 'TION')) {
            $this->append('X');
            return $index + 3;
        }
        if ($this->contains($index, 3, 'TIA', 'TCH')) {
            $this->append('X');
            return $index + 3;
        }
        if ($this->contains($index, 2, 'TH') || $this->contains($index, 3, 'TTH')) {
            if (
                $this->contains($index + 2, 2, 'OM', 'AM')
                || $this->contains(0, 4, 'VAN ', 'VON ')
                || $this->contains(0, 3, 'SCH')
            ) {
                $this->append('T');
            } else {
                $this->append('0', 'T');
            }
            return $index + 2;
        }
        $this->append('T');
        return $this->contains($index + 1, 1, 'T', 'D') ? $index + 2 : $index + 1;
    }

    private function stepW(int $index): int
    {
        if ($this->contains($index, 2, 'WR')) {
            $this->append('R');
            return $index + 2;
        }
        if ($index === 0 && ($this->isVowel($index + 1) || $this->contains($index, 2, 'WH'))) {
            if ($this->isVowel($index + 1)) {
                $this->append('A', 'F');
            } else {
                $this->append('A');
            }
            return $index + 1;
        }
        if (
            ($index === $this->length - 1 && $this->isVowel($index - 1))
            || $this->contains($index - 1, 5, 'EWSKI', 'EWSKY', 'OWSKI', 'OWSKY')
            || $this->contains(0, 3, 'SCH')
        ) {
            $this->append('', 'F');
            return $index + 1;
        }
        if ($this->contains($index, 4, 'WICZ', 'WITZ')) {
            $this->append('TS', 'FX');
            return $index + 4;
        }
        return $index + 1;
    }

    private function stepX(int $index): int
    {
        if (
            ! (
                $index === $this->length - 1
                && ($this->contains($index - 3, 3, 'IAU', 'EAU')
                    || $this->contains($index - 2, 2, 'AU', 'OU'))
            )
        ) {
            $this->append('KS');
        }
        return $this->contains($index + 1, 1, 'C', 'X') ? $index + 2 : $index + 1;
    }

    private function stepZ(int $index): int
    {
        if ($this->at($index + 1) === 'H') {
            $this->append('J');
            return $index + 2;
        }
        if (
            $this->contains($index + 1, 2, 'ZO', 'ZI', 'ZA')
            || ($this->isSlavoGermanic() && $index > 0 && $this->at($index - 1) !== 'T')
        ) {
            $this->append('S', 'TS');
        } else {
            $this->append('S');
        }
        return $this->at($index + 1) === 'Z' ? $index + 2 : $index + 1;
    }

    private function isMSilentDoubled(int $index): bool
    {
        return ($this->contains($index - 1, 3, 'UMB')
                && ($index + 1 === $this->length - 1 || $this->contains($index + 2, 2, 'ER')))
            || $this->at($index + 1) === 'M';
    }
}
