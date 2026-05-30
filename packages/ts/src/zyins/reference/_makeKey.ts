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
export function _makeKey(text: string): string {
  // Uppercase first so locale-specific casefolding does not change which
  // bytes survive the alphanumeric strip.
  const upper = text.toUpperCase();
  let out = '';
  for (let i = 0; i < upper.length; i++) {
    const ch = upper.charCodeAt(i);
    const isDigit = ch >= 0x30 && ch <= 0x39;
    const isUpper = ch >= 0x41 && ch <= 0x5a;
    if (isDigit || isUpper) {
      out += upper[i];
    }
  }
  return out;
}
