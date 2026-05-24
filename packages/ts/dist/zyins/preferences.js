/**
 * Tier 3 preferences operations — `GET /v2/preferences/restore` + `POST /v2/preferences/backup`.
 *
 * Preferences are an opaque JSON document stored per (email,
 * license_order). The SDK does not interpret the document; callers
 * serialize their own settings shape and pass through. Identity is derived
 * from License-HMAC auth headers — body carries no credentials.
 *
 * See `docs/design/cases-email-branding-surface.md` for the #149 auth
 * elevation. When session credentials replace License-HMAC the SDK surface
 * stays unchanged.
 */
import { fromHttpResponse } from './errors';
import { deriveIdempotencyKey } from './idempotency';
import { isRecord, parseJsonResponse, unwrapEnvelope } from './response';
import { buildLicenseHMACHeaders } from '../core';
import { systemClock } from '../core';
const PREFERENCES_RESTORE_PATH = '/v2/preferences/restore';
const PREFERENCES_BACKUP_PATH = '/v2/preferences/backup';
/** Fetch the caller's preferences document. */
export async function lookup(ctx) {
    const headers = await buildLicenseHMACHeaders(ctx.auth.licenseKey, ctx.auth.orderId, ctx.auth.email, 'GET', PREFERENCES_RESTORE_PATH, '', ctx.auth.deviceId, ctx.clock ?? systemClock);
    const response = await ctx.transport({
        url: `${ctx.baseUrl}${PREFERENCES_RESTORE_PATH}`,
        method: 'GET',
        headers: { ...headers, Accept: 'application/json' },
        body: '',
    });
    if (response.status >= 200 && response.status < 300) {
        return { prefs: parsePrefsBody(response.body) };
    }
    throw fromHttpResponse(response.status, response.body);
}
/** Upsert the caller's preferences document. */
export async function set(request, ctx) {
    if (!request || !isRecord(request.prefs)) {
        throw new Error('zyins: preferences.set requires a prefs object');
    }
    const body = JSON.stringify({ prefs: request.prefs });
    const idempotencyKey = ctx.idempotencyKey ??
        (await deriveIdempotencyKey({ deviceId: ctx.auth.deviceId, op: 'preferences_set', body }));
    const headers = await buildLicenseHMACHeaders(ctx.auth.licenseKey, ctx.auth.orderId, ctx.auth.email, 'POST', PREFERENCES_BACKUP_PATH, body, ctx.auth.deviceId, ctx.clock ?? systemClock);
    const response = await ctx.transport({
        url: `${ctx.baseUrl}${PREFERENCES_BACKUP_PATH}`,
        method: 'POST',
        headers: {
            ...headers,
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'Idempotency-Key': idempotencyKey,
        },
        body,
    });
    if (response.status >= 200 && response.status < 300) {
        return { prefs: parsePrefsBody(response.body, request.prefs) };
    }
    throw fromHttpResponse(response.status, response.body);
}
/**
 * Parse a `{prefs: {...}}` or enveloped response. Falls back to the
 * supplied request prefs when the server returns an empty body on success
 * (POST may return 204-style empty on no-extra-data).
 */
function parsePrefsBody(body, fallback) {
    if (!body)
        return fallback ?? {};
    const parsed = parseJsonResponse(body, 'preferences');
    const root = unwrapEnvelope(parsed);
    if (isRecord(root) && 'prefs' in root) {
        const prefs = root.prefs;
        if (isRecord(prefs)) {
            return prefs;
        }
    }
    if (isRecord(root)) {
        return root;
    }
    return fallback ?? {};
}
//# sourceMappingURL=preferences.js.map