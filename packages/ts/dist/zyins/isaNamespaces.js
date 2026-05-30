/**
 * Sub-namespace facades exposed via `Isa.zyins.*`. Each facade delegates
 * to the underlying Tier-3 `ZyInsClient` sub-client, lazily constructed by
 * a `() => ZyInsClient` thunk so namespace construction stays cheap.
 *
 * Separated from `isa.ts` to keep that file under the 250-line cap; this
 * module owns only the facade shape, not the unified `Isa` class itself.
 */
import { assembleLink } from '../account/caseWire';
export { ReferenceFacade, ReferenceMedicationsFacade, ReferenceConditionsFacade, ReferenceConceptsFacade, ReferenceBundleCache, DefaultAutocorrector, DefaultMatchAlgorithm, DefaultAutocompleteAlgorithm, buildSuggestion, } from './reference/index';
import { activate as licenseActivate, check as licenseCheck, deactivate as licenseDeactivate, } from './license';
import { systemClock } from '../core';
import { LogosSubClient, } from './logos';
/**
 * One-shot deprecation warning helpers. Each surface that has a singular →
 * plural (or method-rename) shim logs a `console.warn` exactly once per
 * facade instance so the noise doesn't drown a busy app.
 */
const DEPRECATED_WARNED = new WeakSet();
function warnDeprecatedOnce(scope, message) {
    if (DEPRECATED_WARNED.has(scope))
        return;
    DEPRECATED_WARNED.add(scope);
    if (typeof console !== 'undefined' && typeof console.warn === 'function') {
        console.warn(`[isa-sdk] ${message}`);
    }
}
/** `isa.zyins.branding` — whitelabel lookup. */
export class BrandingFacade {
    clientOnce;
    constructor(clientOnce) {
        this.clientOnce = clientOnce;
    }
    /** Fetch whitelabel branding for the calling license. */
    lookup() {
        return this.clientOnce().branding.lookup();
    }
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
export class DatasetsFacade {
    clientOnce;
    onBundle;
    /**
     * @param clientOnce  Lazy ZyInsClient accessor.
     * @param onBundle    Optional sink invoked with every fresh
     *                    `DatasetBundleV3` returned by `getV3()`. The
     *                    `ZyInsNamespace` wires this to the shared
     *                    `ReferenceBundleCache` so `isa.zyins.reference.match()`
     *                    sees the catalog without any consumer plumbing.
     */
    constructor(clientOnce, onBundle) {
        this.clientOnce = clientOnce;
        this.onBundle = onBundle;
    }
    /**
     * Fetch the legacy v2 reference-data bundle.
     */
    get(options) {
        return this.clientOnce().datasets.get(options);
    }
    /** Alias for `get()` retained for explicit migration call sites. */
    getLegacy(options) {
        return this.get(options);
    }
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
    async getV3(options) {
        const result = await this.clientOnce().datasetsV3.get(options);
        if (this.onBundle !== undefined && !isNotModifiedMarker(result)) {
            this.onBundle(result);
        }
        return result;
    }
}
function isNotModifiedMarker(result) {
    return result.notModified === true;
}
/** `isa.zyins.preferences` — opaque per-license preferences document. */
export class PreferencesFacade {
    clientOnce;
    constructor(clientOnce) {
        this.clientOnce = clientOnce;
    }
    lookup() {
        return this.clientOnce().preferences.lookup();
    }
    set(request) {
        return this.clientOnce().preferences.set(request);
    }
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
export class CasesFacade {
    clientOnce;
    caseStorageOnce;
    caseViewerBaseUrlOnce;
    constructor(clientOnce, caseStorageOnce, caseViewerBaseUrlOnce) {
        this.clientOnce = clientOnce;
        this.caseStorageOnce = caseStorageOnce;
        this.caseViewerBaseUrlOnce = caseViewerBaseUrlOnce;
    }
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
    save(record) {
        return this.caseStorageOnce().put(record);
    }
    /**
     * Resolve a record from the configured {@link CaseStorage} adapter.
     * `recallToken` is required iff `save()` returned one. Returns `null`
     * when the record is absent — adapters do not distinguish "expired"
     * from "never existed" by design.
     */
    recall(id, recallToken) {
        return this.caseStorageOnce().get(id, recallToken);
    }
    share(arg1, recallToken) {
        if (typeof arg1 === 'string') {
            return assembleShareView(arg1, recallToken, this.caseViewerBaseUrlOnce());
        }
        return this.clientOnce().cases.share(arg1);
    }
    /**
     * @deprecated Use `save()` (or the legacy `share(request)` overload).
     * `create()` is a back-compat alias retained until v0.7.0.
     */
    create(request) {
        warnDeprecatedOnce(this, 'isa.zyins.cases.create is deprecated; use isa.zyins.cases.save. Removed in v0.7.0.');
        return this.clientOnce().cases.share(request);
    }
    /** Email a case PDF/artifact to a recipient. */
    email(request) {
        return this.clientOnce().cases.email(request);
    }
}
/**
 * Compose the recipient-visible share view from an id + opaque token.
 * Carrier adapters that surface an opaque token without URL semantics
 * leave `link` `undefined`; the caller threads `(id, recallToken)`
 * through the carrier's documented channel instead.
 */
function assembleShareView(id, recallToken, viewerBaseUrl) {
    if (typeof id !== 'string' || id.length === 0) {
        throw new Error('isa.zyins.cases.share requires a non-empty id');
    }
    if (recallToken === undefined || recallToken.length === 0) {
        return { id, recallToken: undefined, link: undefined };
    }
    return { id, recallToken, link: assembleLink(viewerBaseUrl, id, recallToken) };
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
export class LicenseFacade {
    opts;
    constructor(opts) {
        this.opts = opts;
    }
    /**
     * Activate a license on this device. With no args, the facade fills
     * `email`, `keycode`, and `deviceId` from the parent `Isa`'s credential
     * state. Callers MAY override any field per-call.
     */
    async activate(request) {
        const filled = this.fillActivate(request);
        const result = await licenseActivate(filled, this.buildContext());
        if (result.status === 'active' && isOwnLicenseRequest(this.opts.state, filled)) {
            await this.opts.state.refreshLicenseKey(result.auth.licenseKey);
        }
        return result;
    }
    /** Phone-home validation. Defaults fill from instance state. */
    async check(request) {
        return licenseCheck(this.fillCheck(request), this.buildContext());
    }
    /** Deactivate this device. Clears the stashed license key on success. */
    async deactivate(request) {
        const filled = this.fillDeactivate(request);
        const result = await licenseDeactivate(filled, this.buildContext());
        if (isOwnLicenseRequest(this.opts.state, filled)) {
            await this.opts.state.clearLicenseKey();
        }
        return result;
    }
    buildContext() {
        return {
            baseUrl: this.opts.baseUrl,
            auth: this.opts.state.auth,
            transport: this.opts.transport,
            clock: this.opts.clock ?? systemClock,
        };
    }
    fillActivate(request) {
        const snap = this.opts.state.snapshot();
        return {
            email: request?.email ?? snap.email,
            keycode: request?.keycode ?? snap.keycode,
            deviceId: request?.deviceId ?? snap.deviceId,
        };
    }
    fillCheck(request) {
        const snap = this.opts.state.snapshot();
        const filled = {
            email: request?.email ?? snap.email,
            keycode: request?.keycode ?? snap.keycode,
        };
        const deviceId = request?.deviceId ?? snap.deviceId;
        if (deviceId)
            filled.deviceId = deviceId;
        const licenseKey = request?.licenseKey ?? snap.licenseKey;
        if (licenseKey)
            filled.licenseKey = licenseKey;
        return filled;
    }
    fillDeactivate(request) {
        const snap = this.opts.state.snapshot();
        const filled = {
            email: request?.email ?? snap.email,
            keycode: request?.keycode ?? snap.keycode,
        };
        const deviceId = request?.deviceId ?? snap.deviceId;
        if (deviceId)
            filled.deviceId = deviceId;
        return filled;
    }
}
function isOwnLicenseRequest(state, request) {
    const snap = state.snapshot();
    return (request.email === snap.email &&
        request.keycode === snap.keycode &&
        request.deviceId === snap.deviceId);
}
/**
 * `isa.zyins.email` — transactional email enqueue. Today the server
 * exposes only `POST /v1/email/enqueue`; the SDK surfaces it as
 * `email.enqueue` so future `email.list` / `email.get` operations land
 * without churn.
 */
export class EmailFacade {
    clientOnce;
    constructor(clientOnce) {
        this.clientOnce = clientOnce;
    }
    enqueue(request) {
        return this.clientOnce().cases.email(request);
    }
}
/**
 * `isa.zyins.logos` — carrier-logo asset lookup. The endpoint is on the
 * public-image GET allowlist (no auth headers), so this facade does NOT
 * route through the auth-bound `ZyInsClient`; it talks to the logos
 * sub-client directly via a base-URL + fetcher pair.
 */
export class LogosFacade {
    client;
    constructor(baseUrl, fetchImpl) {
        this.client = new LogosSubClient(baseUrl, fetchImpl);
    }
    get(carrier, opts) {
        return this.client.get(carrier, opts);
    }
}
//# sourceMappingURL=isaNamespaces.js.map