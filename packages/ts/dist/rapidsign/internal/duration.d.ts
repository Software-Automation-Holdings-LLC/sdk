/**
 * Duration parsing.
 *
 * Three accepted input shapes:
 *   1. Number — milliseconds, taken as-is.
 *   2. ISO-8601 duration — `P30D`, `PT24H`, `PT5M`, `PT15S`, `P1DT12H`.
 *   3. Shorthand — `500ms`, `30s`, `5m`, `2h`, `7d`.
 *
 * Returns milliseconds. Throws `RapidSignError.ValidationError` on malformed
 * input so callers can handle SDK validation failures consistently.
 */
/** Maximum duration: 7 days. Anything longer is almost certainly an error. */
export declare const MAX_DURATION_MS: number;
/** Returns true when `spec` is an ISO-8601 duration string (e.g. `P30D`). */
export declare function isIso8601Duration(spec: string): boolean;
/** Parse a duration spec into milliseconds. */
export declare function parseDuration(spec: string | number): number;
//# sourceMappingURL=duration.d.ts.map