/**
 * Internal text→sorted-check-key normalizer.
 *
 * Mirrors the engine's `CondNameMakeCheckKey` (Go
 * `go/zyins/utils/strings/normalize.go`, Perl `cond_name_make_check_key_xs`):
 * uppercase the string, strip every character that is not ASCII
 * alphanumeric, then SORT the surviving bytes ascending. Digits (0x30–0x39)
 * therefore sort before letters (0x41–0x5A), byte-identical to the engine.
 *
 * Sorting collapses word order so that prefix / suffix / no-space variants of
 * the same concept resolve identically while severity qualifiers stay
 * distinct (different letter multisets):
 *   - "SEVERE COPD" → "CCDEEOPRSV"  (after expanding from the catalog name)
 *   - "COPD (SEVERE)" → "CCDEEOPRSV"
 *   - "COPD (MILD)" → "CCDDILMOP"   (distinct — collapses with no SEVERE row)
 *
 * Used ONLY for word-order-invariant NAME matching. Opaque catalog ids
 * (e.g. `HIGHBLOODPRESSURE`, `cond_<ULID>`) are never keyed this way —
 * sorting an id would let unrelated ids collide. Id and exact-name lookups
 * stay on `_makeKey`.
 */
export declare function _checkKey(text: string): string;
//# sourceMappingURL=_checkKey.d.ts.map