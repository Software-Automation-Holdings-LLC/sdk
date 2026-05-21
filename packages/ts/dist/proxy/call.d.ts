/**
 * `proxy.call()` — structured invocation against `/v1/call`, signed with
 * canonical session-credential HMAC.
 *
 * Wire envelope (opaque pass-through; do NOT flatten):
 *
 *   { integration_id | integration_uuid, method, params }
 *
 * Auth headers come from `signRequest()` (the canonical session signer):
 *
 *   Authorization, X-Isa-Session-Id, X-Isa-Timestamp, X-Isa-Signature
 *
 * Plus `Idempotency-Key` (auto-minted UUID v4 if the caller omits one)
 * and `Content-Type: application/json`.
 *
 * This is the SDK↔proxy hop. The proxy↔downstream hop remains Algosure
 * HMAC and is handled server-side — see ADR-035 (amended in this PR).
 */
import { type SessionIdentity } from '../zyins/envFactory';
import { type SignClock } from '../core/auth/signRequest';
/** Inputs to {@link proxyCall}. Exactly one of integrationUuid/integrationId. */
export interface ProxyCallOptions {
    /** Preferred opaque identifier (UUID). Mutually exclusive with integrationId. */
    integrationUuid?: string;
    /** Legacy BIGSERIAL identifier. Mutually exclusive with integrationUuid. */
    integrationId?: number;
    /** Opaque parameters forwarded to the downstream integration. */
    params?: unknown;
    /** Optional HTTP method override at the integration. Defaults to POST. */
    method?: string;
    /** Caller-supplied idempotency key; auto-minted UUID v4 when omitted. */
    idempotencyKey?: string;
    /** Test seam: replaces global fetch. */
    fetchImpl?: typeof fetch;
    /** Test seam: replaces signing-clock. */
    clock?: SignClock;
    /** Test seam: replaces UUID v4 generator. */
    uuid?: () => string;
}
/** Response envelope returned by `/v1/call`. Shape is whatever the server sends. */
export type ProxyCallResult = unknown;
/** Dependencies bound to `proxy.call` at namespace construction. */
export interface ProxyCallBinding {
    /** Base origin, e.g. `https://proxy.isaapi.com`. */
    proxyOrigin: string;
    /** The session identity authenticated by the parent `Isa` instance. */
    identity: SessionIdentity;
}
/**
 * Execute one call against `/v1/call`. The binding carries credentials and
 * origin; per-call options carry the integration target and params.
 */
export declare function proxyCall(binding: ProxyCallBinding, opts: ProxyCallOptions): Promise<ProxyCallResult>;
/** Validate the binding identity is session-mode; throw IsaConfigError otherwise. */
export declare function assertSessionIdentityForProxyCall(identity: {
    mode: string;
}): asserts identity is SessionIdentity;
//# sourceMappingURL=call.d.ts.map