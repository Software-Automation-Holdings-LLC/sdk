/**
 * Tier 3 branding operations — GET `/v1/branding`.
 *
 * Branding is per-license-order whitelabel configuration: agency name, logo
 * URL, colors, and product restrictions. Identity comes from the
 * License-HMAC auth headers; the request carries no body credentials. See
 * `docs/design/cases-email-branding-surface.md` for the #149 auth elevation
 * — when session credentials replace License-HMAC, this SDK surface is
 * unaffected (no method args change).
 *
 * Returns a zero-value `BrandingDetail` when no row exists; the server
 * deliberately does NOT 404 for missing branding rows.
 */
import { fromHttpResponse } from './errors';
import { boolField, isRecord, parseJsonResponse, stringField, unwrapEnvelope } from './response';
import { buildLicenseHMACHeaders } from '../core';
import { systemClock } from '../core';
const BRANDING_PATH = '/v1/branding';
/** Fetch the whitelabel branding for the caller's license. */
export async function lookup(ctx) {
    const headers = await buildLicenseHMACHeaders(ctx.auth.licenseKey, ctx.auth.orderId, ctx.auth.email, 'GET', BRANDING_PATH, '', ctx.auth.deviceId, ctx.clock ?? systemClock);
    const response = await ctx.transport({
        url: `${ctx.baseUrl}${BRANDING_PATH}`,
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
        return zeroBrandingDetail();
    }
    const parsed = parseJsonResponse(body, 'branding.lookup');
    const unwrapped = unwrapEnvelope(parsed);
    const root = isRecord(unwrapped) ? unwrapped : {};
    return {
        imoName: stringField(root, 'imo_name'),
        imoLogo: stringField(root, 'imo_logo'),
        navColor: stringField(root, 'nav_color'),
        mainColor: stringField(root, 'main_color'),
        buttonColor: stringField(root, 'button_color'),
        activeButtonColor: stringField(root, 'active_button_color'),
        bgColor: stringField(root, 'bg_color'),
        headerTextColor: stringField(root, 'header_text_color'),
        hideAffiliateLeads: boolField(root, 'hide_affiliate_leads'),
        preventProductSelection: boolField(root, 'prevent_product_selection'),
        defaultSettings: stringField(root, 'default_settings'),
    };
}
function zeroBrandingDetail() {
    return {
        imoName: '',
        imoLogo: '',
        navColor: '',
        mainColor: '',
        buttonColor: '',
        activeButtonColor: '',
        bgColor: '',
        headerTextColor: '',
        hideAffiliateLeads: false,
        preventProductSelection: false,
        defaultSettings: '',
    };
}
//# sourceMappingURL=branding.js.map