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

import { RapidSignError } from '../errors';

const SECOND_MS = 1_000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const SHORTHAND_RE = /^(\d+)(ms|s|m|h|d)$/i;
const ISO8601_RE = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/;

/** Maximum duration: 7 days. Anything longer is almost certainly an error. */
export const MAX_DURATION_MS = 7 * DAY_MS;

/** Returns true when `spec` is an ISO-8601 duration string (e.g. `P30D`). */
export function isIso8601Duration(spec: string): boolean {
  const normalized = spec.trim().toUpperCase();
  const match = ISO8601_RE.exec(normalized);
  if (!match) return false;
  return isValidIsoDurationMatch(normalized, match);
}

/** Parse a duration spec into milliseconds. */
export function parseDuration(spec: string | number): number {
  if (typeof spec === 'number') {
    if (!Number.isFinite(spec) || spec < 0) {
      throw durationValidationError(`parseDuration: invalid millisecond value: ${spec}`);
    }
    return Math.floor(spec);
  }
  const trimmed = spec.trim();
  if (trimmed.length === 0) {
    throw durationValidationError('parseDuration: empty duration string');
  }
  const shorthand = SHORTHAND_RE.exec(trimmed);
  if (shorthand) {
    const value = Number.parseInt(shorthand[1] as string, 10);
    return value * unitMs(shorthand[2] as string);
  }
  if (trimmed.startsWith('P') || trimmed.startsWith('p')) {
    const normalized = trimmed.toUpperCase();
    const iso = ISO8601_RE.exec(normalized);
    if (iso && isValidIsoDurationMatch(normalized, iso)) {
      return isoDurationTotalMs(iso);
    }
  }
  throw durationValidationError(`parseDuration: unrecognized duration: ${spec}`);
}

function unitMs(unit: string): number {
  switch (unit.toLowerCase()) {
    case 'ms':
      return 1;
    case 's':
      return SECOND_MS;
    case 'm':
      return MINUTE_MS;
    case 'h':
      return HOUR_MS;
    case 'd':
      return DAY_MS;
    default:
      throw durationValidationError(`parseDuration: unknown unit: ${unit}`);
  }
}


function isoDurationTotalMs(match: RegExpExecArray): number {
  const [, d, h, m, s] = match;
  return (
    Number.parseInt(d ?? '0', 10) * DAY_MS +
    Number.parseInt(h ?? '0', 10) * HOUR_MS +
    Number.parseInt(m ?? '0', 10) * MINUTE_MS +
    Number.parseInt(s ?? '0', 10) * SECOND_MS
  );
}

function hasIsoTimeComponents(match: RegExpExecArray): boolean {
  const [, , h, m, s] = match;
  return h !== undefined || m !== undefined || s !== undefined;
}

function isValidIsoDurationMatch(normalized: string, match: RegExpExecArray): boolean {
  if (normalized.includes('T') && !hasIsoTimeComponents(match)) {
    return false;
  }
  const total = isoDurationTotalMs(match);
  return total > 0 || normalized === 'PT0S' || normalized === 'P0D';
}

function durationValidationError(message: string): RapidSignError.ValidationError {
  return new RapidSignError.ValidationError(message, {
    httpStatus: 400,
    requestId: '',
  });
}
