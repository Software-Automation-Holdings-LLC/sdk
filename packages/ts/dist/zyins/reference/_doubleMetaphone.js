/**
 * Double Metaphone phonetic encoder — Lawrence Philips' algorithm, ported
 * from the Apache Commons Codec reference implementation
 * (`org.apache.commons.codec.language.DoubleMetaphone`).
 *
 * Returns a `{ primary, alternate }` pair of phonetic codes. Two strings
 * that sound alike share a code (`sertaline` and `sertraline` both encode
 * to `SRTRLN`; `tylonol` and `tylenol` both to `TLNL`), which lets the
 * fuzzy matcher recover misspellings that edit distance alone misses.
 *
 * This file is the cross-language contract surface: the Go / PHP / C# /
 * Python ports MUST reproduce the same codes for the vector fixture in
 * `doubleMetaphone.vectors.ts`. Keep the branch structure identical when
 * porting — the table below is the canonical reference.
 *
 * Determinism notes for the ports:
 *   - Input is upper-cased with a locale-invariant fold before encoding.
 *     JS `toUpperCase()` is locale-independent; Go must use
 *     `strings.ToUpper`, PHP `mb_strtoupper(..., 'ASCII')` semantics,
 *     C# `ToUpperInvariant`, Python `str.upper()` (already invariant).
 *   - Only ASCII A–Z is processed; any other character is skipped, so the
 *     caller is responsible for NFC-normalizing before calling.
 */
/**
 * Code length. Classic Double Metaphone truncates to 4, which is too lossy
 * for the long compound terms in the medical catalog — `sertraline` (SRTR)
 * and `sertaline` (SRTL) diverge inside the first four symbols. A 6-symbol
 * code keeps enough signal that near-homophone drug names collide
 * (`sertraline`/`sertaline` → `SRTRLN`) while staying short enough to pool
 * genuine homophones. This is the value the cross-language vector fixture
 * pins; the ports MUST use the same length.
 */
const DEFAULT_MAX_CODE_LEN = 6;
const VOWELS = 'AEIOUY';
const SILENT_START = ['GN', 'KN', 'PN', 'WR', 'PS'];
const L_R_N_M_B_H_F_V_W_SPACE = ' BHFVW';
const ES_EP_EB_EL_EY_IB_IL_IN_IE_EI_ER = [
    'ES',
    'EP',
    'EB',
    'EL',
    'EY',
    'IB',
    'IL',
    'IN',
    'IE',
    'EI',
    'ER',
];
const L_T_K_S_N_M_B_Z = 'LTKSNMBZ';
/**
 * Mutable accumulator for the primary + alternate codes. Encapsulates the
 * "append the same to both / append divergent to each" pattern so the
 * step functions stay declarative.
 */
class CodeBuilder {
    maxLength;
    primary = '';
    alternate = '';
    constructor(maxLength) {
        this.maxLength = maxLength;
    }
    append(primary, alternate) {
        this.primary += primary;
        this.alternate += alternate ?? primary;
    }
    done() {
        return this.primary.length >= this.maxLength && this.alternate.length >= this.maxLength;
    }
    build() {
        return {
            primary: this.primary.slice(0, this.maxLength),
            alternate: this.alternate.slice(0, this.maxLength),
        };
    }
}
/** Cursor over the upper-cased input with bounds-safe slice/charAt helpers. */
class Word {
    value;
    constructor(value) {
        this.value = value;
    }
    get length() {
        return this.value.length;
    }
    at(index) {
        if (index < 0 || index >= this.value.length)
            return '';
        return this.value.charAt(index);
    }
    slice(start, end) {
        const lo = Math.max(0, start);
        const hi = Math.min(this.value.length, end);
        if (hi <= lo)
            return '';
        return this.value.slice(lo, hi);
    }
    isVowel(index) {
        const ch = this.at(index);
        return ch !== '' && VOWELS.includes(ch);
    }
    isSlavoGermanic() {
        return /[WK]|CZ|WITZ/.test(this.value);
    }
    contains(start, length, ...candidates) {
        const target = this.slice(start, start + length);
        return candidates.includes(target);
    }
}
/**
 * Encode `input` into its Double Metaphone primary + alternate codes.
 * Non-letters are dropped before encoding; an empty or letter-free input
 * yields empty codes.
 */
export function doubleMetaphone(input, maxLength = DEFAULT_MAX_CODE_LEN) {
    const cleaned = input.toUpperCase().replace(/[^A-Z]/g, '');
    if (cleaned === '')
        return { primary: '', alternate: '' };
    const word = new Word(cleaned);
    const code = new CodeBuilder(maxLength);
    let index = skipSilentStart(word);
    if (word.at(0) === 'X') {
        code.append('S');
        index = 1;
    }
    while (index < word.length && !code.done()) {
        index = step(word, code, index);
    }
    return code.build();
}
/** Skip the silent leading clusters (GN, KN, PN, WR, PS) Philips strips. */
function skipSilentStart(word) {
    const head = word.slice(0, 2);
    return SILENT_START.some((cluster) => cluster === head) ? 1 : 0;
}
/**
 * Encode the character at `index`, appending zero or more code symbols,
 * and return the next index to process. One `case` per consonant family;
 * vowels only contribute at position 0.
 */
function step(word, code, index) {
    const ch = word.at(index);
    switch (ch) {
        case 'A':
        case 'E':
        case 'I':
        case 'O':
        case 'U':
        case 'Y':
            if (index === 0)
                code.append('A');
            return index + 1;
        case 'B':
            code.append('P');
            return word.at(index + 1) === 'B' ? index + 2 : index + 1;
        case 'C':
            return stepC(word, code, index);
        case 'Ç':
            code.append('S');
            return index + 1;
        case 'D':
            return stepD(word, code, index);
        case 'F':
            code.append('F');
            return word.at(index + 1) === 'F' ? index + 2 : index + 1;
        case 'G':
            return stepG(word, code, index);
        case 'H':
            return stepH(word, code, index);
        case 'J':
            return stepJ(word, code, index);
        case 'K':
            code.append('K');
            return word.at(index + 1) === 'K' ? index + 2 : index + 1;
        case 'L':
            return stepL(word, code, index);
        case 'M':
            code.append('M');
            return isMSilentDoubled(word, index) ? index + 2 : index + 1;
        case 'N':
            code.append('N');
            return word.at(index + 1) === 'N' ? index + 2 : index + 1;
        case 'Ñ':
            code.append('N');
            return index + 1;
        case 'P':
            return stepP(word, code, index);
        case 'Q':
            code.append('K');
            return word.at(index + 1) === 'Q' ? index + 2 : index + 1;
        case 'R':
            return stepR(word, code, index);
        case 'S':
            return stepS(word, code, index);
        case 'T':
            return stepT(word, code, index);
        case 'V':
            code.append('F');
            return word.at(index + 1) === 'V' ? index + 2 : index + 1;
        case 'W':
            return stepW(word, code, index);
        case 'X':
            return stepX(word, code, index);
        case 'Z':
            return stepZ(word, code, index);
        default:
            return index + 1;
    }
}
function stepC(word, code, index) {
    if (conditionC0(word, index)) {
        code.append('K');
        return index + 2;
    }
    if (index === 0 && word.contains(index, 6, 'CAESAR')) {
        code.append('S');
        return index + 2;
    }
    if (word.contains(index, 2, 'CH')) {
        return stepCH(word, code, index);
    }
    if (word.contains(index, 2, 'CZ') && !word.contains(index - 2, 4, 'WICZ')) {
        code.append('S', 'X');
        return index + 2;
    }
    if (word.contains(index + 1, 3, 'CIA')) {
        code.append('X');
        return index + 3;
    }
    if (word.contains(index, 2, 'CC') && !(index === 1 && word.at(0) === 'M')) {
        return stepCC(word, code, index);
    }
    if (word.contains(index, 2, 'CK', 'CG', 'CQ')) {
        code.append('K');
        return index + 2;
    }
    if (word.contains(index, 2, 'CI', 'CE', 'CY')) {
        if (word.contains(index, 3, 'CIO', 'CIE', 'CIA'))
            code.append('S', 'X');
        else
            code.append('S');
        return index + 2;
    }
    code.append('K');
    if (word.contains(index + 1, 2, ' C', ' Q', ' G'))
        return index + 3;
    if (word.contains(index + 1, 1, 'C', 'K', 'Q') && !word.contains(index + 1, 2, 'CE', 'CI')) {
        return index + 2;
    }
    return index + 1;
}
function conditionC0(word, index) {
    if (word.contains(index, 4, 'CHIA'))
        return true;
    if (index <= 1)
        return false;
    if (word.isVowel(index - 2))
        return false;
    if (!word.contains(index - 1, 3, 'ACH'))
        return false;
    const c = word.at(index + 2);
    return (c !== 'I' && c !== 'E') || word.contains(index - 2, 6, 'BACHER', 'MACHER');
}
function stepCC(word, code, index) {
    if (word.contains(index + 2, 1, 'I', 'E', 'H') && !word.contains(index + 2, 2, 'HU')) {
        if ((index === 1 && word.at(index - 1) === 'A') ||
            word.contains(index - 1, 5, 'UCCEE', 'UCCES')) {
            code.append('KS');
        }
        else {
            code.append('X');
        }
        return index + 3;
    }
    code.append('K');
    return index + 2;
}
function stepCH(word, code, index) {
    if (index > 0 && word.contains(index, 4, 'CHAE')) {
        code.append('K', 'X');
        return index + 2;
    }
    if (conditionCH0(word, index) || conditionCH1(word, index)) {
        code.append('K');
        return index + 2;
    }
    if (index > 0) {
        code.append(word.contains(0, 2, 'MC') ? 'K' : 'X', 'K');
    }
    else {
        code.append('X');
    }
    return index + 2;
}
function conditionCH0(word, index) {
    if (index !== 0)
        return false;
    if (!word.contains(index + 1, 5, 'HARAC', 'HARIS') &&
        !word.contains(index + 1, 3, 'HOR', 'HYM', 'HIA', 'HEM')) {
        return false;
    }
    return !word.contains(0, 5, 'CHORE');
}
function conditionCH1(word, index) {
    return (word.contains(0, 4, 'VAN ', 'VON ') ||
        word.contains(0, 3, 'SCH') ||
        word.contains(index - 2, 6, 'ORCHES', 'ARCHIT', 'ORCHID') ||
        word.contains(index + 2, 1, 'T', 'S') ||
        ((word.contains(index - 1, 1, 'A', 'O', 'U', 'E') || index === 0) &&
            (word.contains(index + 2, 1, ...L_R_N_M_B_H_F_V_W_SPACE.split('')) ||
                index + 1 === word.length - 1)));
}
function stepD(word, code, index) {
    if (word.contains(index, 2, 'DG')) {
        if (word.contains(index + 2, 1, 'I', 'E', 'Y')) {
            code.append('J');
            return index + 3;
        }
        code.append('TK');
        return index + 2;
    }
    code.append('T');
    return word.contains(index, 2, 'DT', 'DD') ? index + 2 : index + 1;
}
function stepG(word, code, index) {
    if (word.at(index + 1) === 'H')
        return stepGH(word, code, index);
    if (word.at(index + 1) === 'N')
        return stepGN(word, code, index);
    if (word.contains(index + 1, 2, 'LI') && !word.isSlavoGermanic()) {
        code.append('KL', 'L');
        return index + 2;
    }
    if (index === 0 &&
        (word.at(index + 1) === 'Y' ||
            word.contains(index + 1, 2, ...ES_EP_EB_EL_EY_IB_IL_IN_IE_EI_ER))) {
        code.append('K', 'J');
        return index + 2;
    }
    if ((word.contains(index + 1, 2, 'ER') || word.at(index + 1) === 'Y') &&
        !word.contains(0, 6, 'DANGER', 'RANGER', 'MANGER') &&
        !word.contains(index - 1, 1, 'E', 'I') &&
        !word.contains(index - 1, 3, 'RGY', 'OGY')) {
        code.append('K', 'J');
        return index + 2;
    }
    if (word.contains(index + 1, 1, 'E', 'I', 'Y') ||
        word.contains(index - 1, 4, 'AGGI', 'OGGI')) {
        if (word.contains(0, 4, 'VAN ', 'VON ') ||
            word.contains(0, 3, 'SCH') ||
            word.contains(index + 1, 2, 'ET')) {
            code.append('K');
        }
        else if (word.contains(index + 1, 3, 'IER')) {
            code.append('J');
        }
        else {
            code.append('J', 'K');
        }
        return index + 2;
    }
    code.append('K');
    return word.at(index + 1) === 'G' ? index + 2 : index + 1;
}
function stepGH(word, code, index) {
    if (index > 0 && !word.isVowel(index - 1)) {
        code.append('K');
        return index + 2;
    }
    if (index === 0) {
        code.append(word.at(index + 2) === 'I' ? 'J' : 'K');
        return index + 2;
    }
    if ((index > 1 && word.contains(index - 2, 1, 'B', 'H', 'D')) ||
        (index > 2 && word.contains(index - 3, 1, 'B', 'H', 'D')) ||
        (index > 3 && word.contains(index - 4, 1, 'B', 'H'))) {
        return index + 2;
    }
    if (index > 2 && word.at(index - 1) === 'U' && word.contains(index - 3, 1, 'C', 'G', 'L', 'R', 'T')) {
        code.append('F');
    }
    else if (index > 0 && word.at(index - 1) !== 'I') {
        code.append('K');
    }
    return index + 2;
}
function stepGN(word, code, index) {
    if (index === 1 && word.isVowel(0) && !word.isSlavoGermanic()) {
        code.append('KN', 'N');
    }
    else if (!word.contains(index + 2, 2, 'EY') && word.at(index + 1) !== 'Y' && !word.isSlavoGermanic()) {
        code.append('N', 'KN');
    }
    else {
        code.append('KN');
    }
    return index + 2;
}
function stepH(word, code, index) {
    if ((index === 0 || word.isVowel(index - 1)) && word.isVowel(index + 1)) {
        code.append('H');
        return index + 2;
    }
    return index + 1;
}
function stepJ(word, code, index) {
    if (word.contains(index, 4, 'JOSE') || word.contains(0, 4, 'SAN ')) {
        if ((index === 0 && word.at(index + 4) === ' ') || word.contains(0, 4, 'SAN ')) {
            code.append('H');
        }
        else {
            code.append('J', 'H');
        }
        return index + 1;
    }
    if (index === 0 && !word.contains(index, 4, 'JOSE')) {
        code.append('J', 'A');
    }
    else if (word.isVowel(index - 1) &&
        !word.isSlavoGermanic() &&
        (word.at(index + 1) === 'A' || word.at(index + 1) === 'O')) {
        code.append('J', 'H');
    }
    else if (index === word.length - 1) {
        code.append('J', '');
    }
    else if (!word.contains(index + 1, 1, ...L_T_K_S_N_M_B_Z.split('')) && !word.contains(index - 1, 1, 'S', 'K', 'L')) {
        code.append('J');
    }
    return word.at(index + 1) === 'J' ? index + 2 : index + 1;
}
function stepL(word, code, index) {
    if (word.at(index + 1) === 'L') {
        if (conditionL0(word, index)) {
            code.append('L', '');
        }
        else {
            code.append('L');
        }
        return index + 2;
    }
    code.append('L');
    return index + 1;
}
function conditionL0(word, index) {
    if (index === word.length - 3 &&
        word.contains(index - 1, 4, 'ILLO', 'ILLA', 'ALLE')) {
        return true;
    }
    return ((word.contains(word.length - 2, 2, 'AS', 'OS') || word.contains(word.length - 1, 1, 'A', 'O')) &&
        word.contains(index - 1, 4, 'ALLE'));
}
function stepP(word, code, index) {
    if (word.at(index + 1) === 'H') {
        code.append('F');
        return index + 2;
    }
    code.append('P');
    return word.contains(index + 1, 1, 'P', 'B') ? index + 2 : index + 1;
}
function stepR(word, code, index) {
    if (index === word.length - 1 &&
        !word.isSlavoGermanic() &&
        word.contains(index - 2, 2, 'IE') &&
        !word.contains(index - 4, 2, 'ME', 'MA')) {
        code.append('', 'R');
    }
    else {
        code.append('R');
    }
    return word.at(index + 1) === 'R' ? index + 2 : index + 1;
}
function stepS(word, code, index) {
    if (word.contains(index - 1, 3, 'ISL', 'YSL')) {
        return index + 1;
    }
    if (index === 0 && word.contains(index, 5, 'SUGAR')) {
        code.append('X', 'S');
        return index + 1;
    }
    if (word.contains(index, 2, 'SH')) {
        code.append(word.contains(index + 1, 4, 'HEIM', 'HOEK', 'HOLM', 'HOLZ') ? 'S' : 'X');
        return index + 2;
    }
    if (word.contains(index, 3, 'SIO', 'SIA') || word.contains(index, 4, 'SIAN')) {
        code.append(word.isSlavoGermanic() ? 'S' : 'S', word.isSlavoGermanic() ? 'S' : 'X');
        return index + 3;
    }
    if ((index === 0 && word.contains(index + 1, 1, 'M', 'N', 'L', 'W')) ||
        word.contains(index + 1, 1, 'Z')) {
        code.append('S', 'X');
        return word.at(index + 1) === 'Z' ? index + 2 : index + 1;
    }
    if (word.contains(index, 2, 'SC')) {
        return stepSC(word, code, index);
    }
    if (index === word.length - 1 &&
        word.contains(index - 2, 2, 'AI', 'OI')) {
        code.append('', 'S');
    }
    else {
        code.append('S');
    }
    return word.contains(index + 1, 1, 'S', 'Z') ? index + 2 : index + 1;
}
function stepSC(word, code, index) {
    if (word.at(index + 2) === 'H') {
        if (word.contains(index + 3, 2, 'OO', 'ER', 'EN', 'UY', 'ED', 'EM')) {
            code.append(word.contains(index + 3, 2, 'ER', 'EN') ? 'X' : 'SK', 'SK');
        }
        else if (index === 0 && !word.isVowel(3) && word.at(3) !== 'W') {
            code.append('X', 'S');
        }
        else {
            code.append('X');
        }
        return index + 3;
    }
    if (word.contains(index + 2, 1, 'I', 'E', 'Y')) {
        code.append('S');
        return index + 3;
    }
    code.append('SK');
    return index + 3;
}
function stepT(word, code, index) {
    if (word.contains(index, 4, 'TION')) {
        code.append('X');
        return index + 3;
    }
    if (word.contains(index, 3, 'TIA', 'TCH')) {
        code.append('X');
        return index + 3;
    }
    if (word.contains(index, 2, 'TH') || word.contains(index, 3, 'TTH')) {
        if (word.contains(index + 2, 2, 'OM', 'AM') ||
            word.contains(0, 4, 'VAN ', 'VON ') ||
            word.contains(0, 3, 'SCH')) {
            code.append('T');
        }
        else {
            code.append('0', 'T');
        }
        return index + 2;
    }
    code.append('T');
    return word.contains(index + 1, 1, 'T', 'D') ? index + 2 : index + 1;
}
function stepW(word, code, index) {
    if (word.contains(index, 2, 'WR')) {
        code.append('R');
        return index + 2;
    }
    if (index === 0 && (word.isVowel(index + 1) || word.contains(index, 2, 'WH'))) {
        if (word.isVowel(index + 1))
            code.append('A', 'F');
        else
            code.append('A');
        return index + 1;
    }
    if ((index === word.length - 1 && word.isVowel(index - 1)) ||
        word.contains(index - 1, 5, 'EWSKI', 'EWSKY', 'OWSKI', 'OWSKY') ||
        word.contains(0, 3, 'SCH')) {
        code.append('', 'F');
        return index + 1;
    }
    if (word.contains(index, 4, 'WICZ', 'WITZ')) {
        code.append('TS', 'FX');
        return index + 4;
    }
    return index + 1;
}
function stepX(word, code, index) {
    if (!(index === word.length - 1 &&
        (word.contains(index - 3, 3, 'IAU', 'EAU') || word.contains(index - 2, 2, 'AU', 'OU')))) {
        code.append('KS');
    }
    return word.contains(index + 1, 1, 'C', 'X') ? index + 2 : index + 1;
}
function stepZ(word, code, index) {
    if (word.at(index + 1) === 'H') {
        code.append('J');
        return index + 2;
    }
    if (word.contains(index + 1, 2, 'ZO', 'ZI', 'ZA') ||
        (word.isSlavoGermanic() && index > 0 && word.at(index - 1) !== 'T')) {
        code.append('S', 'TS');
    }
    else {
        code.append('S');
    }
    return word.at(index + 1) === 'Z' ? index + 2 : index + 1;
}
function isMSilentDoubled(word, index) {
    return ((word.contains(index - 1, 3, 'UMB') &&
        (index + 1 === word.length - 1 || word.contains(index + 2, 2, 'ER'))) ||
        word.at(index + 1) === 'M');
}
//# sourceMappingURL=_doubleMetaphone.js.map