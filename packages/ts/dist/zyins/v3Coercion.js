/** Shared v3 response coercion helpers for prequalify and quote parsing. */
import { isRecord } from './response';
export { isRecord };
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
export function coerceMoney(raw) {
    const r = isRecord(raw) ? raw : {};
    return { cents: toNum(r['cents']), display: toStr(r['display']) };
}
//# sourceMappingURL=v3Coercion.js.map