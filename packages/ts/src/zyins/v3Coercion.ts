/** Shared v3 response coercion helpers for prequalify and quote parsing. */

import { isRecord } from './response';
import type { OfferCarrier, OfferProduct } from './prequalify-v2-types';
import type { V3Money } from './prequalify-v3-types';

export { isRecord };

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

export function coerceMoney(raw: unknown): V3Money {
  const r = isRecord(raw) ? raw : {};
  return { cents: toNum(r['cents']), display: toStr(r['display']) };
}
