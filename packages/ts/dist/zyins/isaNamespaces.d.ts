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
import { type CaseShareRequest, type CaseShareResult } from './cases';
import { type CaseEmailRequest, type CaseEmailResult } from './case';
import type { CaseRecord, CaseStorage, CaseStoragePutResult } from './cases/CaseStorage';
import { type DatasetBundle, type DatasetsGetOptions } from './datasets';
import { type DatasetBundleV3, type DatasetsV3GetOptions, type DatasetsV3NotModified } from './datasets-v3';
import { type Concept, type ConditionConcept, type MedicationConcept, type UnknownConcept } from './reference';
export { ReferenceFacade, ReferenceMedicationsFacade, ReferenceConditionsFacade, ReferenceConceptsFacade, ReferenceBundleCache, DefaultAutocorrector, DefaultMatchAlgorithm, DefaultAutocompleteAlgorithm, buildSuggestion, } from './reference/index';
export type { Autocorrector, AutocorrectOptions, AutocorrectAppliedEvent, DefaultAutocorrectorOptions, MatchAlgorithm, DefaultMatchAlgorithmOptions, AutocompleteAlgorithm, AutocompleteOptions, DefaultAutocompleteAlgorithmOptions, Suggestion, ReferenceAdapters, } from './reference/index';
import { type LicenseActivateRequest, type LicenseActivateResult, type LicenseCheckRequest, type LicenseCheckResult, type LicenseDeactivateRequest, type LicenseDeactivateResult } from './license';
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
/**
 * `isa.zyins.datasets` — reference-data bundle for picker UIs.
 *
 * `get()` preserves the existing v2 bundle contract for callers that
 * have not migrated their downstream parsing.
 *
 * `getV3()` is the v3 endpoint (`GET /v3/datasets`) and is the canonical
 * SDK surface going forward. It returns typed `{id, name}` entities and
 * id-keyed relationship maps — consumers never re-derive keys.
 */
export declare class DatasetsFacade {
    private readonly clientOnce;
    private readonly onBundle?;
    /**
     * @param clientOnce  Lazy ZyInsClient accessor.
     * @param onBundle    Optional sink invoked with every fresh
     *                    `DatasetBundleV3` returned by `getV3()`. The
     *                    `ZyInsNamespace` wires this to the shared
     *                    `ReferenceBundleCache` so `isa.zyins.reference.match()`
     *                    sees the catalog without any consumer plumbing.
     */
    constructor(clientOnce: ClientThunk, onBundle?: ((bundle: DatasetBundleV3) => void) | undefined);
    /**
     * Fetch the legacy v2 reference-data bundle.
     */
    get(options?: DatasetsGetOptions): Promise<DatasetBundle>;
    /** Alias for `get()` retained for explicit migration call sites. */
    getLegacy(options?: DatasetsGetOptions): Promise<DatasetBundle>;
    /**
     * Fetch the v3 reference catalog. Pass `{ include }` to narrow,
     * `{ fields: 'meta' }` for the cheap names+versions check, or
     * `{ ifNoneMatch: etag }` to revalidate.
     *
     * Returns either a `DatasetBundleV3` or a `DatasetsV3NotModified`
     * marker when the server responded `304`; use `isNotModified()` to
     * discriminate.
     *
     * On a fresh-bundle response, the `onBundle` callback (if supplied) is
     * invoked synchronously before the promise resolves. The
     * `ZyInsNamespace` uses this hook to warm the reference index.
     */
    getV3(options?: DatasetsV3GetOptions): Promise<DatasetBundleV3 | DatasetsV3NotModified>;
}
export type { Concept, ConditionConcept, MedicationConcept, UnknownConcept };
/** `isa.zyins.preferences` — opaque per-license preferences document. */
export declare class PreferencesFacade {
    private readonly clientOnce;
    constructor(clientOnce: ClientThunk);
    lookup(): Promise<PreferencesLookupResult>;
    set(request: PreferencesSetRequest): Promise<PreferencesSetResult>;
}
/**
 * `isa.zyins.cases` — case share + email.
 *
 * Per the locked-spec surface (Section 3 Flow 5 + Appendix B post-lock
 * correction #2): the canonical verb is `share({ input, results?, products? })`.
 * One method, optional analysis fields. The recipient's UI
 * (`forceReadonlyAtom` in bpp2.0) decides RO vs RW display state — the SDK
 * has no `mode` flag.
 *
 * @example
 * ```ts
 * // RW link (no analysis snapshot):
 * const rw = await isa.zyins.cases.share({ input: currentCaseToJSON() });
 *
 * // RO link (analysis snapshot included):
 * const ro = await isa.zyins.cases.share({
 *   input:    currentCaseToJSON(),
 *   results:  currentAnalysisResult,
 *   products: selectedProducts,
 * });
 * ```
 */
export declare class CasesFacade {
    private readonly clientOnce;
    private readonly caseStorageOnce;
    private readonly caseViewerBaseUrlOnce;
    constructor(clientOnce: ClientThunk, caseStorageOnce: () => CaseStorage, caseViewerBaseUrlOnce: () => string);
    /**
     * Persist a record through the resolved {@link CaseStorage} adapter.
     * The default {@link ZeroKnowledgeCaseStorage} encrypts client-side and
     * returns the per-record key as `recallToken`; carrier adapters may
     * return a different token shape or omit it entirely. Treat the token
     * as opaque.
     *
     * @example
     * ```ts
     * const { id, recallToken } = await isa.zyins.cases.save({
     *   product: 'zyins',
     *   payload: { input: currentCaseToJSON() },
     * });
     * ```
     */
    save(record: CaseRecord): Promise<CaseStoragePutResult>;
    /**
     * Resolve a record from the configured {@link CaseStorage} adapter.
     * `recallToken` is required iff `save()` returned one. Returns `null`
     * when the record is absent — adapters do not distinguish "expired"
     * from "never existed" by design.
     */
    recall(id: string, recallToken?: string): Promise<CaseRecord | null>;
    /**
     * Share an existing record by id + opaque recallToken. Built-in:
     * assembles `${caseViewerBaseUrl}/c/<id>#k=<recallToken>`. Carrier
     * adapters may not have URL semantics; in that case the recipient
     * exchanges `(id, recallToken)` through whatever channel the carrier
     * documents — the SDK has no shared URL contract for non-default
     * adapters and returns `undefined` for the link.
     *
     * Overload 2 — the legacy `share(request)` shape — persists a quote
     * snapshot and returns the assembled share link in one call. Retained
     * for back-compat; new code prefers `save()` + `share(id, token)`.
     */
    share(id: string, recallToken?: string): {
        id: string;
        recallToken: string | undefined;
        link: string | undefined;
    };
    share(request: CaseShareRequest): Promise<CaseShareResult>;
    /**
     * @deprecated Use `save()` (or the legacy `share(request)` overload).
     * `create()` is a back-compat alias retained until v0.7.0.
     */
    create(request: CaseShareRequest): Promise<CaseShareResult>;
    /** Email a case PDF/artifact to a recipient. */
    email(request: CaseEmailRequest): Promise<CaseEmailResult>;
}
/** Construction options for the credential-aware `LicenseFacade`. */
export interface LicenseFacadeOptions {
    /** Shared credential state owned by the parent `Isa`. */
    state: IsaCredentialState;
    /** Base URL for the license surface. */
    baseUrl: string;
    /** Transport facade (default fetch; tests inject a stub). */
    transport: Transport;
    /** Clock facade for HMAC timestamps. */
    clock?: Clock;
}
/**
 * `isa.zyins.license` — license lifecycle (activate / check / deactivate).
 *
 * Per the locked-spec surface (post-lock correction #3): a device has
 * exactly one license, so the namespace is singular. The wire is also
 * singular (`/v1/license/activate`).
 *
 * Every method accepts an optional partial request; missing fields fall back
 * to the credentials the parent `Isa` was constructed with. The first
 * successful `activate()` updates the shared credential state in place so
 * subsequent calls (`prequalify`, `cases.share`, …) sign with the new
 * license key automatically — no caller re-bootstrap.
 *
 * @example
 * ```ts
 * import { Isa } from '@software-automation-holdings-llc/sdk';
 * const isa = await Isa.withKeycode({
 *   keycode: 'SDV-HWH-WDD',
 *   email:   'john.doe@acme-agency.com',
 * });
 * const result = await isa.zyins.license.activate();
 * console.log(result.remainingActivations);
 * ```
 */
export declare class LicenseFacade {
    private readonly opts;
    constructor(opts: LicenseFacadeOptions);
    /**
     * Activate a license on this device. With no args, the facade fills
     * `email`, `keycode`, and `deviceId` from the parent `Isa`'s credential
     * state. Callers MAY override any field per-call.
     */
    activate(request?: Partial<LicenseActivateRequest>): Promise<LicenseActivateResult>;
    /** Phone-home validation. Defaults fill from instance state. */
    check(request?: Partial<LicenseCheckRequest>): Promise<LicenseCheckResult>;
    /** Deactivate this device. Clears the stashed license key on success. */
    deactivate(request?: Partial<LicenseDeactivateRequest>): Promise<LicenseDeactivateResult>;
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
//# sourceMappingURL=isaNamespaces.d.ts.map