/**
 * Tier 3 ZyINS client.
 *
 * The class is the explicit-context idiom from ADR-035: the caller passes
 * `auth` at construction (or each sub-method call carries its own context).
 * The `react/useZyIns` and `vue/useZyIns` helpers wrap this class for the
 * context-bound idiom; the underlying logic is the same in both cases.
 *
 * Injectable facades:
 *   - `transport`: HTTP layer (defaults to `defaultTransport()`).
 *   - `clock`:     time source (defaults to `systemClock`).
 *
 * Locked invariants (per ADR-035 "invariants over options"):
 *   - `baseUrl` defaults to the production ZyINS endpoint; staging is opt-in.
 *   - Idempotency keys are derived; no `options.idempotencyKey` on Tier 3
 *     surface beyond an internal override used by replay tests.
 *   - Retries and backoff are NOT exposed here; they live in Tier 2.
 */
import { defaultTransport } from './transport';
import { systemClock } from '../core';
import { prequalify, prequalifyLegacyBlob, } from './prequalify';
import { activate as licenseActivate, check as licenseCheck, deactivate as licenseDeactivate, } from './license';
import { getReadiness } from './health';
import { email } from './case';
import { lookup as brandingLookup } from './branding';
import { DatasetsSubClient } from './datasets';
import { lookup as preferencesLookup, set as preferencesSet, } from './preferences';
import { create as casesCreate, } from './cases';
import { LogosSubClient } from './logos';
/** Production ZyINS endpoint. Override only for staging / local. */
export const DEFAULT_ZYINS_BASE_URL = 'https://zyins.isaapi.com';
/**
 * The Tier 3 ZyINS client. Construct once per auth context; methods are
 * grouped under typed sub-clients (`license`, `case`) for discoverability.
 * `prequalify` lives at the top level because it is the single most common
 * call.
 */
export class ZyInsClient {
    auth;
    baseUrl;
    transport;
    clock;
    logosFetch;
    /**
     * Proto-backed license-lifecycle sub-client. Targets `/v1/licenses/*`.
     * The TS surface is singular: a device has exactly one license.
     */
    license;
    /** Platform readiness probe (`/ready`). Unauthenticated. */
    health;
    case;
    /** Whitelabel branding lookup. See `branding.ts`. */
    branding;
    /** Per-license preferences document storage. See `preferences.ts`. */
    preferences;
    /** Case create + share. See `cases.ts`. */
    cases;
    /** Carrier-logo lookup. See `logos.ts`. */
    logos;
    /** Reference-data bundle (`isa.zyins.datasets.get()`). */
    datasets;
    constructor(options) {
        this.auth = options.auth;
        this.baseUrl = options.baseUrl ?? DEFAULT_ZYINS_BASE_URL;
        this.transport = options.transport ?? defaultTransport();
        this.clock = options.clock ?? systemClock;
        this.logosFetch = options.logosFetch;
        this.license = new LicenseSubClient(this.context());
        this.health = new HealthSubClient(this.context());
        this.case = new CaseSubClient(this.context());
        this.branding = new BrandingSubClient(this.context());
        this.preferences = new PreferencesSubClient(this.context());
        this.cases = new CasesSubClient(this.context());
        this.logos = new LogosSubClient(this.baseUrl, this.logosFetch);
        this.datasets = new DatasetsSubClient(this.context());
    }
    /** Run a prequalify call. See `PrequalifyRequest` for input shape. */
    async prequalify(request) {
        return prequalify(request, this.context());
    }
    /**
     * Run a prequalify call from a pre-encoded legacy payload. Mirrors
     * `prequalify` but accepts an opaque encoded blob produced by a legacy
     * encoder (e.g. bpp2.0's `prepEncObj` / `prepEncObjV2`) and sends it as
     * the request body verbatim. Returns the same typed `PrequalifyResult`.
     */
    async prequalifyLegacyBlob(request) {
        return prequalifyLegacyBlob(request, this.context());
    }
    /** Internal: produce the shared context object every operation needs. */
    context() {
        return {
            auth: this.auth,
            baseUrl: this.baseUrl,
            transport: this.transport,
            clock: this.clock,
        };
    }
}
/**
 * Proto-backed license-lifecycle sub-client. Targets `/v1/licenses/activate`,
 * `/v1/licenses/check`, and `/v1/licenses/deactivate`. The TS surface is
 * singular (one license per device); the wire paths remain plural.
 */
class LicenseSubClient {
    ctx;
    constructor(ctx) {
        this.ctx = ctx;
    }
    activate(request) {
        return licenseActivate(request, this.ctx);
    }
    check(request) {
        return licenseCheck(request, this.ctx);
    }
    deactivate(request) {
        return licenseDeactivate(request, this.ctx);
    }
}
/** Platform readiness sub-client. Targets `/ready` (no auth). */
class HealthSubClient {
    ctx;
    constructor(ctx) {
        this.ctx = ctx;
    }
    getReadiness() {
        return getReadiness({ baseUrl: this.ctx.baseUrl, transport: this.ctx.transport });
    }
}
/** Sub-client exposing case-level operations (email, future: pdf, send). */
class CaseSubClient {
    ctx;
    constructor(ctx) {
        this.ctx = ctx;
    }
    email(request) {
        return email(request, this.ctx);
    }
}
/** Whitelabel branding sub-client. Targets `GET /v1/branding`. */
class BrandingSubClient {
    ctx;
    constructor(ctx) {
        this.ctx = ctx;
    }
    lookup() {
        return brandingLookup(this.ctx);
    }
}
/** Preferences sub-client. Targets `GET` / `POST /v1/preferences`. */
class PreferencesSubClient {
    ctx;
    constructor(ctx) {
        this.ctx = ctx;
    }
    lookup() {
        return preferencesLookup(this.ctx);
    }
    set(request) {
        return preferencesSet(request, this.ctx);
    }
}
/**
 * Cases sub-client. Targets `POST /v1/case` for create and
 * `POST /v1/email/enqueue` for case-share email. Future `list`/`get`/
 * `delete` operations require net-new server work tracked in the design doc.
 */
class CasesSubClient {
    ctx;
    constructor(ctx) {
        this.ctx = ctx;
    }
    /**
     * Share a case (RW + optional analysis). Canonical surface per the locked
     * spec (Section 3 Flow 5 + Appendix B post-lock correction #2). The
     * recipient's UI decides RO vs RW based on whether `results` is present;
     * the SDK has no `mode` flag.
     */
    share(request) {
        return casesCreate(request, this.ctx);
    }
    /**
     * @deprecated Use `share()` instead. `create()` is retained as a back-compat
     * alias and will be removed in v0.7.0. See
     * `/tmp/sdk-syntax-proposal.md` Appendix B post-lock correction #2.
     */
    create(request) {
        return casesCreate(request, this.ctx);
    }
    email(request) {
        return email(request, this.ctx);
    }
}
//# sourceMappingURL=client.js.map