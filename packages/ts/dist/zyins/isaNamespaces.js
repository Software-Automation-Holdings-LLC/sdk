/**
 * Sub-namespace facades exposed via `Isa.zyins.*`. Each facade delegates
 * to the underlying Tier-3 `ZyInsClient` sub-client, lazily constructed by
 * a `() => ZyInsClient` thunk so namespace construction stays cheap.
 *
 * Separated from `isa.ts` to keep that file under the 250-line cap; this
 * module owns only the facade shape, not the unified `Isa` class itself.
 */
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
/** `isa.zyins.datasets` — reference-data bundle for picker UIs. */
export class DatasetsFacade {
    clientOnce;
    constructor(clientOnce) {
        this.clientOnce = clientOnce;
    }
    /**
     * Returns the full reference-data bundle (medications, conditions,
     * products, etc.). Pass `{ include }` to fetch a subset.
     */
    get(options) {
        return this.clientOnce().datasets.get(options);
    }
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
    constructor(clientOnce) {
        this.clientOnce = clientOnce;
    }
    /**
     * Share a case from quote input + optional analysis snapshot. Returns the
     * shareable URL. Canonical per the locked spec.
     */
    share(request) {
        return this.clientOnce().cases.share(request);
    }
    /**
     * @deprecated Use `share()`. `create()` is a back-compat alias that
     * forwards to the same wire call; will be removed in v0.7.0. See
     * `/tmp/sdk-syntax-proposal.md` Appendix B post-lock correction #2.
     */
    create(request) {
        warnDeprecatedOnce(this, 'isa.zyins.cases.create is deprecated; use isa.zyins.cases.share. Removed in v0.7.0.');
        return this.clientOnce().cases.share(request);
    }
    /** Email a case PDF/artifact to a recipient. */
    email(request) {
        return this.clientOnce().cases.email(request);
    }
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