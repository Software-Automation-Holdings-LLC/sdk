/**
 * `isa.account.preferences` — `GET` / `POST /v1/preferences`.
 *
 * Per-license opaque settings document, partitioned by caller-supplied
 * `scope`. bpp2.0 passes `scope: "bpp"`; future surfaces (eApp, agent
 * dashboard) will pass their own value so writes do not stomp each other.
 *
 * The SDK does not interpret the document; callers serialize their own
 * settings shape and pass through. Identity comes from License-HMAC auth
 * headers — body carries no credentials.
 */
import { type AuthContext } from './auth';
import { type Transport } from '../zyins/transport';
import { type Clock } from '../core';
/** Opaque preferences document — keys and values are caller-defined. */
export type PreferencesDocument = Record<string, unknown>;
/** Input for `account.preferences.lookup`. */
export interface PreferencesLookupRequest {
    /** Required partition key. Different surfaces pass different scopes. */
    scope: string;
}
export interface PreferencesLookupResult {
    prefs: PreferencesDocument;
}
/** Input for `account.preferences.set`. */
export interface PreferencesSetRequest {
    /** Required partition key matching the corresponding `lookup`. */
    scope: string;
    /** Document to upsert. */
    prefs: PreferencesDocument;
}
export interface PreferencesSetResult {
    /** True on successful upsert. */
    ok: true;
}
export interface PreferencesContext {
    baseUrl: string;
    auth: AuthContext;
    transport: Transport;
    clock: Clock;
    idempotencyKey?: string;
}
/** Fetch the preferences document for the supplied scope. */
export declare function lookup(request: PreferencesLookupRequest, ctx: PreferencesContext): Promise<PreferencesLookupResult>;
/** Upsert the preferences document for the supplied scope. */
export declare function set(request: PreferencesSetRequest, ctx: PreferencesContext): Promise<PreferencesSetResult>;
//# sourceMappingURL=preferences.d.ts.map