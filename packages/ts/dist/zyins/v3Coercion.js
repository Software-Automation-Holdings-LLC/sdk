/** Shared v3 response coercion helpers for prequalify and quote parsing. */
import { isRecord } from './response.js';
export { isRecord };
const V3_PERIODS = new Set(['monthly', 'quarterly', 'semiannual', 'annual']);
export const toStr = (v) => (typeof v === 'string' ? v : '');
export const toNum = (v) => typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : 0;
export const toBool = (v) => v === true;
export const toNullableNum = (v) => typeof v === 'number' && Number.isFinite(v) ? v : null;
export function coerceCarrier(raw) {
    const r = isRecord(raw) ? raw : {};
    return {
        id: toStr(r['id']),
        name: toStr(r['name']),
        logo_url: toStr(r['logo_url']),
    };
}
export function coerceProduct(raw) {
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
export function coerceAmount(raw) {
    const r = isRecord(raw) ? raw : {};
    return { cents: toNum(r['cents']), display: toStr(r['display']) };
}
/**
 * Coerce a `{amount: {cents, display}, period}` value (OpenAPI `Money`).
 * `period` falls back to `null` (a one-time lump sum) for any value outside
 * the closed enum, so an unknown future period never poisons the type.
 */
export function coerceMoney(raw) {
    const r = isRecord(raw) ? raw : {};
    const periodRaw = r['period'];
    const period = typeof periodRaw === 'string' && V3_PERIODS.has(periodRaw) ? periodRaw : null;
    return { amount: coerceAmount(r['amount']), period };
}
//# sourceMappingURL=v3Coercion.js.map