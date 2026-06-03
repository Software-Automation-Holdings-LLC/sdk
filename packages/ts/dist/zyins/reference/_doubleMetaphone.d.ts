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
/** Phonetic code pair: identical when the word has no alternate reading. */
export interface DoubleMetaphoneCode {
    readonly primary: string;
    readonly alternate: string;
}
/**
 * Encode `input` into its Double Metaphone primary + alternate codes.
 * Non-letters are dropped before encoding; an empty or letter-free input
 * yields empty codes.
 */
export declare function doubleMetaphone(input: string, maxLength?: number): DoubleMetaphoneCode;
//# sourceMappingURL=_doubleMetaphone.d.ts.map