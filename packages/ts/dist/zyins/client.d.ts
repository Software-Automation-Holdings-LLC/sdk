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
import { type LicenseActivateResult, type LicenseCheckResult } from './license';
import { type CaseEmailRequest, type CaseEmailResult } from './case';
/** Per-call context shared across sub-clients. */
interface OperationContext {
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
    readonly license: LicenseSubClient;
    readonly case: CaseSubClient;
    constructor(options: ZyInsClientOptions);
    /** Run a prequalify call. See `PrequalifyRequest` for input shape. */
    prequalify(request: PrequalifyRequest): Promise<PrequalifyResult>;
    /** Internal: produce the shared context object every operation needs. */
    private context;
}
/** Sub-client exposing license activation / deactivation / check. */
declare class LicenseSubClient {
    private readonly ctx;
    constructor(ctx: OperationContext);
    activate(): Promise<LicenseActivateResult>;
    deactivate(): Promise<void>;
    check(): Promise<LicenseCheckResult>;
}
/** Sub-client exposing case-level operations (email, future: pdf, send). */
declare class CaseSubClient {
    private readonly ctx;
    constructor(ctx: OperationContext);
    email(request: CaseEmailRequest): Promise<CaseEmailResult>;
}
export {};
//# sourceMappingURL=client.d.ts.map