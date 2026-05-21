/**
 * `isa.account.branding` — `GET /v1/branding`.
 *
 * Whitelabel configuration for the calling license: agency name, logo URL,
 * theme colors. Identity comes from License-HMAC auth headers; the request
 * carries no body credentials. The server returns a zero-value document
 * when no branding row exists (it does NOT 404), so the SDK never
 * synthesizes a "no branding" error — callers receive an empty `BrandingDetail`.
 *
 * The optional `source` field is reserved for the future per-vendor
 * branding endpoint (e.g. `source: 'mountain-life'`) — it is sent as a
 * query parameter when supplied so we don't churn the typed surface when
 * the server lands the extension.
 */
import { fromHttpResponse } from '../zyins/errors';
import { boolField, firstStringField, isRecord, stringField, unwrapEnvelope } from '../zyins/response';
import { buildLicenseHMACHeaders } from '../core';
import { systemClock } from '../core';
const BRANDING_PATH = '/v1/branding';
/** Fetch the whitelabel branding for the caller's license. */
export async function lookup(request, ctx) {
    const query = request?.source ? `?source=${encodeURIComponent(request.source)}` : '';
    const path = `${BRANDING_PATH}${query}`;
    const headers = await buildLicenseHMACHeaders(ctx.auth.licenseKey, ctx.auth.orderId, ctx.auth.email, 'GET', path, '', ctx.auth.deviceId, ctx.clock ?? systemClock);
    const response = await ctx.transport({
        url: `${ctx.baseUrl}${path}`,
        method: 'GET',
        headers: { ...headers, Accept: 'application/json' },
        body: '',
    });
    if (response.status >= 200 && response.status < 300) {
        return parseBrandingResponse(response.body);
    }
    throw fromHttpResponse(response.status, response.body);
}
function parseBrandingResponse(body) {
    if (!body) {
        return zeroBranding();
    }
    let parsed;
    try {
        parsed = JSON.parse(body);
    }
    catch (err) {
        throw new Error(`account: branding response was not valid JSON: ${err.message}`);
    }
    const unwrapped = unwrapEnvelope(parsed);
    const root = isRecord(unwrapped) ? unwrapped : {};
    return {
        imoName: stringField(root, 'imo_name'),
        imoLogo: stringField(root, 'imo_logo'),
        primaryColor: firstStringField(root, ['primary_color', 'main_color']),
        navColor: stringField(root, 'nav_color'),
        bgColor: stringField(root, 'bg_color'),
        buttonColor: stringField(root, 'button_color'),
        activeButtonColor: stringField(root, 'active_button_color'),
        headerTextColor: stringField(root, 'header_text_color'),
        hideAffiliateLeads: boolField(root, 'hide_affiliate_leads'),
        preventProductSelection: boolField(root, 'prevent_product_selection'),
        defaultSettings: stringField(root, 'default_settings'),
    };
}
function zeroBranding() {
    return {
        imoName: '',
        imoLogo: '',
        primaryColor: '',
        navColor: '',
        bgColor: '',
        buttonColor: '',
        activeButtonColor: '',
        headerTextColor: '',
        hideAffiliateLeads: false,
        preventProductSelection: false,
        defaultSettings: '',
    };
}
//# sourceMappingURL=branding.js.map