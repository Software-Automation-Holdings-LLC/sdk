/** Shared v3 response coercion helpers for prequalify and quote parsing. */

import { isRecord } from './response.js';
import type { OfferCarrier, OfferProduct } from './prequalify-v2-types.js';
import type { V3Amount, V3Money, V3Period } from './prequalify-v3-types.js';

export { isRecord };

const V3_PERIODS: ReadonlySet<string> = new Set(['monthly', 'quarterly', 'semiannual', 'annual']);

export const toStr = (v: unknown): string => (typeof v === 'string' ? v : '');
export const toNum = (v: unknown): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : 0;
export const toBool = (v: unknown): boolean => v === true;
export const toNullableNum = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;

export function coerceCarrier(raw: unknown): OfferCarrier {
  const r = isRecord(raw) ? raw : {};
  return {
    id: toStr(r['id']),
    name: toStr(r['name']),
    logo_url: toStr(r['logo_url']),
  };
}

export function coerceProduct(raw: unknown): OfferProduct {
  const r = isRecord(raw) ? raw : {};
  return {
    id: toStr(r['id']),
    slug: toStr(r['slug']),
    name: toStr(r['name']),
    display_name: toStr(r['display_name']),
    type: toStr(r['type']),
    wire_token: toStr(r['wire_token']),
  };
}

/** Coerce the leaf `{cents, display}` amount (OpenAPI `AmountResponse`). */
export function coerceAmount(raw: unknown): V3Amount {
  const r = isRecord(raw) ? raw : {};
  return { cents: toNum(r['cents']), display: toStr(r['display']) };
}

/**
 * Coerce a `{amount: {cents, display}, period}` value (OpenAPI `Money`).
 * `period` falls back to `null` (a one-time lump sum) for any value outside
 * the closed enum, so an unknown future period never poisons the type.
 */
export function coerceMoney(raw: unknown): V3Money {
  const r = isRecord(raw) ? raw : {};
  const periodRaw = r['period'];
  const period: V3Period =
    typeof periodRaw === 'string' && V3_PERIODS.has(periodRaw) ? (periodRaw as V3Period) : null;
  return { amount: coerceAmount(r['amount']), period };
}
