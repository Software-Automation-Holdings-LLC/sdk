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
import { prequalify } from './prequalify';
import { activate, deactivate, check, } from './license';
import { email } from './case';
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
    license;
    case;
    constructor(options) {
        this.auth = options.auth;
        this.baseUrl = options.baseUrl ?? DEFAULT_ZYINS_BASE_URL;
        this.transport = options.transport ?? defaultTransport();
        this.clock = options.clock ?? systemClock;
        this.license = new LicenseSubClient(this.context());
        this.case = new CaseSubClient(this.context());
    }
    /** Run a prequalify call. See `PrequalifyRequest` for input shape. */
    async prequalify(request) {
        return prequalify(request, this.context());
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
/** Sub-client exposing license activation / deactivation / check. */
class LicenseSubClient {
    ctx;
    constructor(ctx) {
        this.ctx = ctx;
    }
    activate() {
        return activate(this.ctx);
    }
    deactivate() {
        return deactivate(this.ctx);
    }
    check() {
        return check(this.ctx);
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
//# sourceMappingURL=client.js.map