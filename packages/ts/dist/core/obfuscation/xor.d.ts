/**
 * XOR-based string obfuscation used by the eapp-system local storage and
 * in-memory caches (`_fusc` / `_checkObfuscation`).
 *
 * THIS IS NOT CRYPTOGRAPHY. It is an anti-shoulder-surfing and
 * anti-casual-inspection measure. Do NOT use this to protect secrets in
 * transit or at rest against a motivated attacker. Use real encryption
 * (see `ragnarokEncrypt` / platform KMS) for that.
 *
 * Wire-compatible with the original `_fusc` when called without a key (or
 * with the default legacy key): `obfuscate(x)` === `_fusc(x)` byte-for-byte.
 * eapp's storage layer reads existing obfuscated values, so the default
 * behavior cannot change.
 *
 * Ported from eapp-system/resources/js/lib/secure-validation-library.js
 * (`_fusc` / `_checkObfuscation`).
 */
/**
 * Legacy single-byte XOR key (0xAA) used by `_fusc`. Exported so callers
 * and tests can reference the canonical default without magic numbers.
 */
export declare const LEGACY_FUSC_KEY: string;
/**
 * Default threshold for {@link isObfuscated}: fraction of non-ASCII chars
 * above which a string is considered obfuscated. Matches `_checkObfuscation`.
 */
export declare const DEFAULT_OBFUSCATION_THRESHOLD = 0.8;
/**
 * XOR-obfuscate `input` with `key`. The transform is its own inverse, so
 * {@link deobfuscate} is a synonym.
 *
 * When `key` has length 1 (the default), every input char is XORed with
 * the same byte — matching the legacy `_fusc` wire format exactly. When
 * `key` has length >1, the key bytes cycle over the input.
 *
 * @param input Value to transform. Coerced to string (matches `_fusc`).
 * @param key   XOR key. Defaults to {@link LEGACY_FUSC_KEY} for wire compat.
 */
export declare function obfuscate(input: string, key?: string): string;
/**
 * Inverse of {@link obfuscate}. Identical implementation because XOR is
 * self-inverse; the separate name exists for call-site readability.
 */
export declare function deobfuscate(input: string, key?: string): string;
/**
 * Heuristic: does `value` look like it was produced by {@link obfuscate}?
 *
 * The test measures the fraction of non-ASCII (code point > 127) code units.
 * Because the legacy key 0xAA pushes most printable ASCII above 127, an
 * obfuscated ASCII string has a high non-ASCII ratio, while a plain
 * ASCII string has zero.
 *
 * NOT a security check — an attacker can trivially craft strings that
 * pass or fail this heuristic. Used only to detect already-obfuscated
 * values in caches to avoid double-obfuscation.
 */
export declare function isObfuscated(value: string, threshold?: number): boolean;
//# sourceMappingURL=xor.d.ts.map