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
import { type AuthContext } from './auth';
import { type Transport } from './transport';
import { type Clock } from '../core';
/** Whitelabel detail returned by `branding.lookup`. */
export interface BrandingDetail {
    imoName: string;
    imoLogo: string;
    navColor: string;
    mainColor: string;
    buttonColor: string;
    activeButtonColor: string;
    bgColor: string;
    headerTextColor: string;
    hideAffiliateLeads: boolean;
    preventProductSelection: boolean;
    defaultSettings: string;
}
/** Per-call context. */
export interface BrandingContext {
    baseUrl: string;
    auth: AuthContext;
    transport: Transport;
    clock: Clock;
}
/** Fetch the whitelabel branding for the caller's license. */
export declare function lookup(ctx: BrandingContext): Promise<BrandingDetail>;
//# sourceMappingURL=branding.d.ts.map