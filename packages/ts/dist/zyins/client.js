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
import { defaultTransport } from './transport.js';
import { systemClock } from '../core/index.js';
import { prequalify, } from './prequalify.js';
import { prequalifyV2, } from './prequalify-v2.js';
import { prequalifyV3, } from './prequalify-v3.js';
import { quoteV3, } from './quote-v3.js';
import { DatasetsV3SubClient } from './datasets-v3.js';
import { activate as licenseActivate, check as licenseCheck, deactivate as licenseDeactivate, } from './license.js';
import { getReadiness } from './health.js';
import { email } from './case.js';
import { lookup as brandingLookup } from './branding.js';
import { DatasetsSubClient } from './datasets.js';
import { lookup as preferencesLookup, set as preferencesSet, } from './preferences.js';
import { share as casesShare, } from './cases.js';
import { DEFAULT_CASE_VIEWER_BASE_URL } from '../account/cases.js';
import { LogosSubClient } from './logos.js';
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
    caseViewerBaseUrl;
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
    /**
     * Legacy v2 reference-data bundle. Prefer `datasetsV3` for new code;
     * the SDK's public `isa.zyins.datasets` facade routes to v3.
     */
    datasets;
    /** v3 reference catalog (`GET /v3/datasets`). */
    datasetsV3;
    constructor(options) {
        this.auth = options.auth;
        this.baseUrl = options.baseUrl ?? DEFAULT_ZYINS_BASE_URL;
        this.caseViewerBaseUrl = options.caseViewerBaseUrl ?? DEFAULT_CASE_VIEWER_BASE_URL;
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
        this.datasetsV3 = new DatasetsV3SubClient(this.context());
    }
    /** Run a prequalify call. See `PrequalifyRequest` for input shape. */
    async prequalify(request) {
        return prequalify(request, this.context());
    }
    /**
     * Run the v2 prequalify call (`POST /v2/prequalify`). Returns one
     * `PlanOffer` per product with the best qualifying tier at the top
     * level and alternates in `other_offers[]`. Pass
     * `options: { includeIneligible: true }` to also receive declined
     * products / declined alternates.
     */
    async prequalifyV2(request) {
        return prequalifyV2(request, this.context());
    }
    /**
     * Run the v3 prequalify call (`POST /v3/prequalify`). Returns one
     * offer per product with a uniform `pricing[]` table — each row is a
     * rate class carrying its own eligibility, premium, and rank. Array
     * order of `pricing` is authoritative for display.
     */
    async prequalifyV3(request) {
        return prequalifyV3(request, this.context());
    }
    /**
     * Run the v3 quote call (`POST /v3/quote`). Returns qualifying
     * products grouped by requested amount with the same uniform
     * `pricing[]` table as v3 prequalify.
     */
    async quoteV3(request) {
        return quoteV3(request, this.context());
    }
    /** Internal: produce the shared context object every operation needs. */
    context() {
        return {
            auth: this.auth,
            baseUrl: this.baseUrl,
            caseViewerBaseUrl: this.caseViewerBaseUrl,
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
 * Cases sub-client. `share` stores an opaque, client-encrypted case via the
 * zero-knowledge `/v1/case` store and returns the fragment-keyed link;
 * `email` enqueues a case email. The decryption key never reaches the server.
 */
class CasesSubClient {
    ctx;
    constructor(ctx) {
        this.ctx = ctx;
    }
    /**
     * Surface the bound signed-request context so the unified `Isa`
     * namespace can construct a `ZeroKnowledgeCaseStorage` adapter without
     * duplicating the auth/transport/clock plumbing. Internal — not part of
     * the published SDK surface.
     */
    get context() {
        return this.ctx;
    }
    /**
     * Share a zyins case (input + optional analysis snapshot). Encrypts
     * client-side and returns the fragment-keyed link. The recipient's UI
     * decides RO vs RW based on whether `results` is present; the SDK has no
     * `mode` flag.
     *
     * @example
     * ```ts
     * const { id, link } = await isa.zyins.cases.share({
     *   input: currentCaseToJSON(),
     * });
     * ```
     */
    share(request) {
        return casesShare(request, this.ctx);
    }
    /**
     * @deprecated Use `share()` instead. `create()` is a back-compat alias that
     * forwards to the same opaque-case flow; removed in v0.7.0.
     *
     * @example
     * ```ts
     * const { id, link } = await isa.zyins.cases.create({ input });
     * ```
     */
    create(request) {
        return casesShare(request, this.ctx);
    }
    email(request) {
        return email(request, this.ctx);
    }
}
//# sourceMappingURL=client.js.map