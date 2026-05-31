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
import { type AuthContext } from './auth.js';
import { type Transport } from './transport.js';
import { type Clock } from '../core/index.js';
/** Opaque preferences document. */
export type PreferencesDocument = Record<string, unknown>;
export interface PreferencesLookupResult {
    prefs: PreferencesDocument;
}
export interface PreferencesSetRequest {
    prefs: PreferencesDocument;
}
export interface PreferencesSetResult {
    prefs: PreferencesDocument;
}
export interface PreferencesContext {
    baseUrl: string;
    auth: AuthContext;
    transport: Transport;
    clock: Clock;
    idempotencyKey?: string;
}
/** Fetch the caller's preferences document. */
export declare function lookup(ctx: PreferencesContext): Promise<PreferencesLookupResult>;
/** Upsert the caller's preferences document. */
export declare function set(request: PreferencesSetRequest, ctx: PreferencesContext): Promise<PreferencesSetResult>;
//# sourceMappingURL=preferences.d.ts.map