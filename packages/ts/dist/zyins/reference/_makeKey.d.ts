/**
 * Internal text→key normalizer.
 *
 * Mirrors Go's `MakeKey` in `go/zyins/models/makekey.go`: uppercase the
 * string, then strip every character that is not ASCII alphanumeric.
 * "High Blood Pressure" → "HIGHBLOODPRESSURE".
 *
 * This function is module-private. Consumers must use `reference.match()`
 * and never compute keys themselves — the catalog id may change over time
 * (today `HIGHBLOODPRESSURE`, tomorrow `cond_<ULID>`).
 */
export declare function _makeKey(text: string): string;
//# sourceMappingURL=_makeKey.d.ts.map