/**
 * Sub-namespace facades exposed via `Isa.zyins.*`. Each facade delegates
 * to the underlying Tier-3 `ZyInsClient` sub-client, lazily constructed by
 * a `() => ZyInsClient` thunk so namespace construction stays cheap.
 *
 * Separated from `isa.ts` to keep that file under the 250-line cap; this
 * module owns only the facade shape, not the unified `Isa` class itself.
 */
import { type ZyInsClient } from './client';
import { type BrandingDetail } from './branding';
import { type PreferencesLookupResult, type PreferencesSetRequest, type PreferencesSetResult } from './preferences';
import { type CaseCreateRequest, type CaseCreateResult } from './cases';
import { type CaseEmailRequest, type CaseEmailResult } from './case';
import { type LicensesActivateRequest, type LicensesActivateResult, type LicensesCheckRequest, type LicensesCheckResult, type LicensesDeactivateRequest, type LicensesDeactivateResult } from './licenses';
import { type IsaCredentialState } from './credentialState';
import { type Transport } from './transport';
import { type Clock } from '../core';
import { type LogosFetch, type LogosGetOptions } from './logos';
type ClientThunk = () => ZyInsClient;
/** `isa.zyins.branding` — whitelabel lookup. */
export declare class BrandingFacade {
    private readonly clientOnce;
    constructor(clientOnce: ClientThunk);
    /** Fetch whitelabel branding for the calling license. */
    lookup(): Promise<BrandingDetail>;
}
/** `isa.zyins.preferences` — opaque per-license preferences document. */
export declare class PreferencesFacade {
    private readonly clientOnce;
    constructor(clientOnce: ClientThunk);
    lookup(): Promise<PreferencesLookupResult>;
    set(request: PreferencesSetRequest): Promise<PreferencesSetResult>;
}
/** `isa.zyins.cases` — case create + share. */
export declare class CasesFacade {
    private readonly clientOnce;
    constructor(clientOnce: ClientThunk);
    /** Create a shareable case from quote input + results + products. */
    create(request: CaseCreateRequest): Promise<CaseCreateResult>;
    /** Email a case PDF/artifact to a recipient. */
    email(request: CaseEmailRequest): Promise<CaseEmailResult>;
}
/** Construction options for the credential-aware `LicensesFacade`. */
export interface LicensesFacadeOptions {
    /** Shared credential state owned by the parent `Isa`. */
    state: IsaCredentialState;
    /** Base URL for the licenses surface. */
    baseUrl: string;
    /** Transport facade (default fetch; tests inject a stub). */
    transport: Transport;
    /** Clock facade for HMAC timestamps. */
    clock?: Clock;
}
/**
 * `isa.zyins.licenses` — license lifecycle (activate / check / deactivate).
 *
 * Every method accepts an optional partial request; missing fields fall back
 * to the credentials the parent `Isa` was constructed with. The first
 * successful `activate()` updates the shared credential state in place so
 * subsequent calls (`prequalify`, `cases.create`, …) sign with the new
 * license key automatically — no caller re-bootstrap.
 */
export declare class LicensesFacade {
    private readonly opts;
    constructor(opts: LicensesFacadeOptions);
    /**
     * Activate a license on this device. With no args, the facade fills
     * `email`, `keycode`, and `deviceId` from the parent `Isa`'s credential
     * state. Callers MAY override any field per-call.
     */
    activate(request?: Partial<LicensesActivateRequest>): Promise<LicensesActivateResult>;
    /** Phone-home validation. Defaults fill from instance state. */
    check(request?: Partial<LicensesCheckRequest>): Promise<LicensesCheckResult>;
    /** Deactivate this device. Clears the stashed license key on success. */
    deactivate(request?: Partial<LicensesDeactivateRequest>): Promise<LicensesDeactivateResult>;
    private buildContext;
    private fillActivate;
    private fillCheck;
    private fillDeactivate;
}
/**
 * `isa.zyins.email` — transactional email enqueue. Today the server
 * exposes only `POST /v1/email/enqueue`; the SDK surfaces it as
 * `email.enqueue` so future `email.list` / `email.get` operations land
 * without churn.
 */
export declare class EmailFacade {
    private readonly clientOnce;
    constructor(clientOnce: ClientThunk);
    enqueue(request: CaseEmailRequest): Promise<CaseEmailResult>;
}
/**
 * `isa.zyins.logos` — carrier-logo asset lookup. The endpoint is on the
 * public-image GET allowlist (no auth headers), so this facade does NOT
 * route through the auth-bound `ZyInsClient`; it talks to the logos
 * sub-client directly via a base-URL + fetcher pair.
 */
export declare class LogosFacade {
    private readonly client;
    constructor(baseUrl: string, fetchImpl: LogosFetch | undefined);
    /**
     * Fetch the carrier-logo asset. With `dataUri: true` the promise resolves
     * to a `data:image/...` string; otherwise it resolves to a `Blob` of the
     * raw image bytes.
     */
    get(carrier: string, opts: LogosGetOptions & {
        dataUri: true;
    }): Promise<string>;
    get(carrier: string, opts?: LogosGetOptions & {
        dataUri?: false | undefined;
    }): Promise<Blob>;
    get(carrier: string, opts?: LogosGetOptions): Promise<Blob | string>;
}
export {};
//# sourceMappingURL=isaNamespaces.d.ts.map