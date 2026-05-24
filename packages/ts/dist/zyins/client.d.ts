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
import { type AuthContext } from './auth';
import { type Transport } from './transport';
import { type Clock } from '../core';
import { type PrequalifyRequest, type PrequalifyResult } from './prequalify';
import { type LicenseActivateRequest, type LicenseActivateResult, type LicenseCheckRequest, type LicenseCheckResult, type LicenseDeactivateRequest, type LicenseDeactivateResult } from './license';
import { type ReadinessResult } from './health';
import { type CaseEmailRequest, type CaseEmailResult } from './case';
import { type BrandingDetail } from './branding';
import { DatasetsSubClient } from './datasets';
import { type PreferencesLookupResult, type PreferencesSetRequest, type PreferencesSetResult } from './preferences';
import { type CaseCreateRequest, type CaseCreateResult } from './cases';
import { LogosSubClient, type LogosFetch } from './logos';
/** Per-call context shared across sub-clients. */
export interface OperationContext {
    auth: AuthContext;
    baseUrl: string;
    transport: Transport;
    clock: Clock;
}
/** Production ZyINS endpoint. Override only for staging / local. */
export declare const DEFAULT_ZYINS_BASE_URL = "https://zyins.isaapi.com";
/** Construction options for `ZyInsClient`. */
export interface ZyInsClientOptions {
    /** Auth identity. Required. */
    auth: AuthContext;
    /** Base URL override; defaults to {@link DEFAULT_ZYINS_BASE_URL}. */
    baseUrl?: string;
    /** Transport override; defaults to {@link defaultTransport}. */
    transport?: Transport;
    /** Clock override; defaults to {@link systemClock}. */
    clock?: Clock;
    /**
     * Logos fetcher override. The `/v1/logos/{carrier}` endpoint returns
     * binary bytes by default, which the standard string-bodied {@link Transport}
     * cannot carry; logos therefore uses a dedicated facade that tests inject
     * here. Production defaults to `globalThis.fetch`.
     */
    logosFetch?: LogosFetch;
}
/**
 * The Tier 3 ZyINS client. Construct once per auth context; methods are
 * grouped under typed sub-clients (`license`, `case`) for discoverability.
 * `prequalify` lives at the top level because it is the single most common
 * call.
 */
export declare class ZyInsClient {
    private readonly auth;
    private readonly baseUrl;
    private readonly transport;
    private readonly clock;
    private readonly logosFetch;
    /**
     * Proto-backed license-lifecycle sub-client. Targets `/v1/licenses/*`.
     * The TS surface is singular: a device has exactly one license.
     */
    readonly license: LicenseSubClient;
    /** Platform readiness probe (`/ready`). Unauthenticated. */
    readonly health: HealthSubClient;
    readonly case: CaseSubClient;
    /** Whitelabel branding lookup. See `branding.ts`. */
    readonly branding: BrandingSubClient;
    /** Per-license preferences document storage. See `preferences.ts`. */
    readonly preferences: PreferencesSubClient;
    /** Case create + share. See `cases.ts`. */
    readonly cases: CasesSubClient;
    /** Carrier-logo lookup. See `logos.ts`. */
    readonly logos: LogosSubClient;
    /** Reference-data bundle (`isa.zyins.datasets.get()`). */
    readonly datasets: DatasetsSubClient;
    constructor(options: ZyInsClientOptions);
    /** Run a prequalify call. See `PrequalifyRequest` for input shape. */
    prequalify(request: PrequalifyRequest): Promise<PrequalifyResult>;
    /** Internal: produce the shared context object every operation needs. */
    private context;
}
/**
 * Proto-backed license-lifecycle sub-client. Targets `/v1/licenses/activate`,
 * `/v1/licenses/check`, and `/v1/licenses/deactivate`. The TS surface is
 * singular (one license per device); the wire paths remain plural.
 */
declare class LicenseSubClient {
    private readonly ctx;
    constructor(ctx: OperationContext);
    activate(request: LicenseActivateRequest): Promise<LicenseActivateResult>;
    check(request: LicenseCheckRequest): Promise<LicenseCheckResult>;
    deactivate(request: LicenseDeactivateRequest): Promise<LicenseDeactivateResult>;
}
/** Platform readiness sub-client. Targets `/ready` (no auth). */
declare class HealthSubClient {
    private readonly ctx;
    constructor(ctx: OperationContext);
    getReadiness(): Promise<ReadinessResult>;
}
/** Sub-client exposing case-level operations (email, future: pdf, send). */
declare class CaseSubClient {
    private readonly ctx;
    constructor(ctx: OperationContext);
    email(request: CaseEmailRequest): Promise<CaseEmailResult>;
}
/** Whitelabel branding sub-client. Targets `GET /v1/branding`. */
declare class BrandingSubClient {
    private readonly ctx;
    constructor(ctx: OperationContext);
    lookup(): Promise<BrandingDetail>;
}
/** Preferences sub-client. Targets `GET` / `POST /v1/preferences`. */
declare class PreferencesSubClient {
    private readonly ctx;
    constructor(ctx: OperationContext);
    lookup(): Promise<PreferencesLookupResult>;
    set(request: PreferencesSetRequest): Promise<PreferencesSetResult>;
}
/**
 * Cases sub-client. Targets `POST /v1/case` for create and
 * `POST /v1/email/enqueue` for case-share email. Future `list`/`get`/
 * `delete` operations require net-new server work tracked in the design doc.
 */
declare class CasesSubClient {
    private readonly ctx;
    constructor(ctx: OperationContext);
    /**
     * Share a case (RW + optional analysis). Canonical surface per the locked
     * spec (Section 3 Flow 5 + Appendix B post-lock correction #2). The
     * recipient's UI decides RO vs RW based on whether `results` is present;
     * the SDK has no `mode` flag.
     */
    share(request: CaseCreateRequest): Promise<CaseCreateResult>;
    /**
     * @deprecated Use `share()` instead. `create()` is retained as a back-compat
     * alias and will be removed in v0.7.0. See
     * `/tmp/sdk-syntax-proposal.md` Appendix B post-lock correction #2.
     */
    create(request: CaseCreateRequest): Promise<CaseCreateResult>;
    email(request: CaseEmailRequest): Promise<CaseEmailResult>;
}
export {};
//# sourceMappingURL=client.d.ts.map