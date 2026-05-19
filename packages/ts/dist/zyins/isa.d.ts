/**
 * `Isa` — the unified SDK facade (SDK_DESIGN.md §3, §5).
 *
 * One client per process, constructed via a factory matching the consumer's
 * auth context. Today the class delegates ZyINS product calls into the
 * existing Tier 3 `ZyInsClient`; over time the namespaces (`isa.zyins.*`,
 * `isa.rapidsign.*`, `isa.account.*`) will absorb the rest of the surface.
 *
 * Phase 1+2 scope (this commit):
 *   - Env-var auto-detection in `withBearer` / `withLicense` / `withSession`.
 *   - Typed `IsaConfigError` thrown when env is missing.
 *   - `ISA_LOG=debug` activates a stderr request/response logger.
 *   - Idempotency-conflict 409 funnels into `IsaIdempotencyConflictError`.
 *   - Every method exposes a `.withRawResponse` sibling returning
 *     `{ data, response }` where `response` carries status/headers/url.
 *   - `Envelope<T>` carries typed `requestId`, `idempotencyKey`,
 *     `retryAttempts` named fields.
 *
 * Concurrency: the client carries no shared mutable state. Multiple in-
 * flight calls on one instance are safe (see README "Concurrency safety").
 */
import { type IsaIdentity } from './envFactory';
import { type DebugLogger, type EnvReader, type LogSink } from './logger';
import { type Envelope, type RawResponseResult } from './envelope';
import { type PrequalifyRequest, type PrequalifyResult } from './prequalify';
import { WebhooksService } from '../rapidsign/webhooks';
/** Constructor options for `Isa`. */
export interface IsaOptions {
    /** Auth identity from one of the three factories. */
    identity: IsaIdentity;
    /** Base URL override; defaults to the production ZyINS endpoint. */
    baseUrl?: string;
    /**
     * Device ID required to construct a license-mode product client. Auto-
     * loaded from storage on first product call in a future phase; today it
     * must be supplied alongside the license identity for product methods to
     * be callable.
     */
    deviceId?: string;
    /** Order identifier; license-mode product client requires it. */
    orderId?: string;
    /** Optional structured logger. Overrides ISA_LOG=debug auto-detection. */
    logger?: DebugLogger;
    /** Optional env reader; tests inject a stub. */
    env?: EnvReader;
    /** Optional log sink; tests inject a stub. */
    logSink?: LogSink;
}
/**
 * Unified SDK entry point.
 *
 * Construct via a factory:
 * ```ts
 * const isa = Isa.withBearer();                       // ISA_TOKEN
 * const isa = Isa.withLicense({ deviceId });          // ISA_LICENSE_*
 * const isa = Isa.withSession();                      // ISA_SESSION_*
 * ```
 */
export declare class Isa {
    /** The resolved auth identity. */
    readonly identity: IsaIdentity;
    /** Active debug logger, if `ISA_LOG=debug` or one was injected. */
    readonly logger: DebugLogger | undefined;
    /** Product namespaces. */
    readonly zyins: ZyInsNamespace;
    /** RapidSign namespace — typed surface; live methods land with issue #38. */
    readonly rapidsign: RapidSignNamespace;
    /** Proxy namespace — internal-facing; transport composition only. */
    readonly proxy: ProxyNamespace;
    /** Top-level webhook verifier. */
    readonly webhooks: WebhooksService;
    private constructor();
    /**
     * Construct from a bearer token (server-to-server `isa_live_…` tokens).
     * With no arguments, reads `ISA_TOKEN` from the environment. Throws
     * `IsaConfigError` when neither is supplied.
     */
    static withBearer(args?: {
        token?: string;
    }, env?: EnvReader): Isa;
    /**
     * Construct from a license keycode + email (BPP agent tools). With no
     * arguments, reads `ISA_LICENSE_KEYCODE` and `ISA_LICENSE_EMAIL` from the
     * environment.
     *
     * `deviceId` and `orderId` may be supplied to unlock product methods now;
     * in a later phase the SDK will load them from durable storage on first
     * product call.
     */
    static withLicense(args?: {
        keycode?: string;
        email?: string;
        deviceId?: string;
        orderId?: string;
    }, env?: EnvReader): Isa;
    /**
     * Construct from a session (id, secret) — embedded forms. With no
     * arguments, reads `ISA_SESSION_ID` and the session-secret env var from
     * the environment.
     */
    static withSession(args?: {
        sessionId?: string;
        sessionSecret?: string;
    }, env?: EnvReader): Isa;
}
/** Internal options the zyins namespace needs from its parent `Isa`. */
interface ZyInsNamespaceOptions {
    identity: IsaIdentity;
    baseUrl?: string;
    deviceId?: string;
    orderId?: string;
    logger?: DebugLogger;
}
/**
 * `isa.zyins.*` — methods for the ZyINS product. Each method has a
 * `.withRawResponse` sibling returning `{ data, response }`.
 *
 * Bearer and session-mode product calls are reserved for a follow-up phase
 * (transport wiring exists in @isa-sdk/core; the namespace stub raises a
 * clear `IsaConfigError` if invoked before that phase lands).
 */
export declare class ZyInsNamespace {
    private readonly opts;
    private readonly clientOnce;
    constructor(opts: ZyInsNamespaceOptions);
    /**
     * Run the prequalify decision. Returns an `Envelope<PrequalifyResult>`
     * with named `requestId`, `idempotencyKey`, and `retryAttempts` fields.
     */
    prequalify(request: PrequalifyRequest): Promise<Envelope<PrequalifyResult>>;
    /** Raw-response sibling of `prequalify`. */
    prequalifyRaw: (request: PrequalifyRequest) => Promise<RawResponseResult<PrequalifyResult>>;
}
/** Top-level helper to add `.withRawResponse` siblings ergonomically. */
export interface RawCallable<TArgs extends unknown[], TResult> {
    (...args: TArgs): Promise<Envelope<TResult>>;
    withRawResponse(...args: TArgs): Promise<RawResponseResult<TResult>>;
}
/** Wrap a result in an envelope. Defaults for the optional fields are documented in SDK_DESIGN §4.6. */
export declare function wrapEnvelope<T>(data: T, requestId: string): Envelope<T>;
/**
 * `isa.rapidsign.*` — RapidSign product namespace.
 *
 * Server surface tracking issue #38; today the namespace exposes a typed
 * verifier (delegated to {@link WebhooksService}) and reserves the room
 * for `documents`. Construction is auth-agnostic — RapidSign credentials
 * are scoped per envelope, not per `Isa`.
 */
export declare class RapidSignNamespace {
    /** Webhook verifier — alias of `isa.webhooks` for spec-alignment. */
    readonly webhooks: WebhooksService;
}
/**
 * `isa.proxy.*` — internal-facing transport namespace. The proxy surface
 * is not consumed by application code (per `@isa-sdk/proxy` ADR-035); it
 * exists on the unified `Isa` instance for parity with the spec and for
 * the SDK's own transport composition.
 */
export declare class ProxyNamespace {
    /**
     * Placeholder — proxy transport is composed internally by product
     * namespaces. Direct invocation lands with the bearer / session
     * transport wiring in Phase 3 of SDK_DESIGN.md.
     */
    call(): never;
}
export {};
//# sourceMappingURL=isa.d.ts.map