/**
 * `isa.account.branding` — `GET /v2/branding`.
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
import { type AuthContext } from './auth.js';
import { type Transport } from '../zyins/transport.js';
import { type Clock } from '../core/index.js';
/** Whitelabel detail returned by `account.branding.lookup`. */
export interface BrandingDetail {
    /** Display name of the agency. */
    imoName: string;
    /** Absolute URL to the agency logo. */
    imoLogo: string;
    /** Primary brand color (hex). */
    primaryColor: string;
    /** Header background color (hex). */
    navColor: string;
    /** Body / content background color (hex). */
    bgColor: string;
    /** Button background color (hex). */
    buttonColor: string;
    /** Active-state button color (hex). */
    activeButtonColor: string;
    /** Header text color (hex). */
    headerTextColor: string;
    /** When true, affiliate-lead capture UI is hidden. */
    hideAffiliateLeads: boolean;
    /** When true, product-selection UI is hidden. */
    preventProductSelection: boolean;
    /** Opaque per-agency defaults document (JSON or URL-encoded form). */
    defaultSettings: string;
}
/** Optional inputs for `account.branding.lookup`. */
export interface BrandingLookupRequest {
    /** Per-vendor branding source override (server-side allowlist). */
    source?: string;
}
/** Per-call context — provided by the namespace facade. */
export interface BrandingContext {
    baseUrl: string;
    auth: AuthContext;
    transport: Transport;
    clock: Clock;
}
/** Fetch the whitelabel branding for the caller's license. */
export declare function lookup(request: BrandingLookupRequest | undefined, ctx: BrandingContext): Promise<BrandingDetail>;
//# sourceMappingURL=branding.d.ts.map