/**
 * Sub-namespace facades exposed via `Isa.zyins.*`. Each facade delegates
 * to the underlying Tier-3 `ZyInsClient` sub-client, lazily constructed by
 * a `() => ZyInsClient` thunk so namespace construction stays cheap.
 *
 * Separated from `isa.ts` to keep that file under the 250-line cap; this
 * module owns only the facade shape, not the unified `Isa` class itself.
 */
import { activate as licensesActivate, check as licensesCheck, deactivate as licensesDeactivate, } from './licenses';
import { systemClock } from '../core';
import { LogosSubClient, } from './logos';
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
/** `isa.zyins.cases` — case create + share. */
export class CasesFacade {
    clientOnce;
    constructor(clientOnce) {
        this.clientOnce = clientOnce;
    }
    /** Create a shareable case from quote input + results + products. */
    create(request) {
        return this.clientOnce().cases.create(request);
    }
    /** Email a case PDF/artifact to a recipient. */
    email(request) {
        return this.clientOnce().cases.email(request);
    }
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
export class LicensesFacade {
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
        const result = await licensesActivate(filled, this.buildContext());
        if (result.status === 'active' && isOwnLicenseRequest(this.opts.state, filled)) {
            await this.opts.state.refreshLicenseKey(result.auth.licenseKey);
        }
        return result;
    }
    /** Phone-home validation. Defaults fill from instance state. */
    async check(request) {
        return licensesCheck(this.fillCheck(request), this.buildContext());
    }
    /** Deactivate this device. Clears the stashed license key on success. */
    async deactivate(request) {
        const filled = this.fillDeactivate(request);
        const result = await licensesDeactivate(filled, this.buildContext());
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