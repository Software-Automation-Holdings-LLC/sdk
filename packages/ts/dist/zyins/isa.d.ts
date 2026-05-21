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
import { type CredentialStore } from '../core';
import { IsaCredentialState, type LicenseRefreshedListener } from './credentialState';
import { type DebugLogger, type EnvReader, type LogSink } from './logger';
import { type Envelope, type RawResponseResult } from './envelope';
import { type Transport } from './transport';
import { type LogosFetch } from './logos';
import { type PrequalifyRequest, type PrequalifyLegacyBlobRequest, type PrequalifyResult } from './prequalify';
import { WebhooksService } from '../rapidsign/webhooks';
import { type ProxyCallOptions, type ProxyCallResult } from '../proxy/call';
import { BrandingFacade, PreferencesFacade, CasesFacade, EmailFacade, LicensesFacade, LogosFacade } from './isaNamespaces';
import { AccountNamespace } from '../account';
/** Constructor options for `Isa`. */
export interface IsaOptions {
    /** Auth identity from one of the three factories. */
    identity: IsaIdentity;
    /** Base URL override; defaults to the production ZyINS endpoint. */
    baseUrl?: string;
    /** Proxy origin override; defaults to the production proxy endpoint. */
    proxyOrigin?: string;
    /**
     * Device ID required to construct a license-mode product client. Auto-
     * loaded from storage on first product call in a future phase; today it
     * must be supplied alongside the license identity for product methods to
     * be callable.
     */
    deviceId?: string;
    /** Order identifier; defaults to the license keycode when unspecified. */
    orderId?: string;
    /** Optional structured logger. Overrides ISA_LOG=debug auto-detection. */
    logger?: DebugLogger;
    /** Optional env reader; tests inject a stub. */
    env?: EnvReader;
    /** Optional log sink; tests inject a stub. */
    logSink?: LogSink;
    /**
     * Pluggable credential store (AsyncStorage / localStorage / custom).
     * Defaults to an in-memory store — state survives the process but NOT a
     * restart. Pass an adapter to persist `deviceId` + `licenseKey` across
     * boots; see `@isa-sdk/core/storage` for ready-made wrappers.
     */
    credentialStore?: CredentialStore;
    /**
     * Pre-stashed license key from a prior activation. Useful for callers
     * who load credentials from their own storage and want to skip the
     * SDK-level lookup.
     */
    licenseKey?: string;
    /** Listener invoked whenever the SDK stashes a fresh license key. */
    onLicenseRefreshed?: LicenseRefreshedListener;
    /** Transport override for the licenses surface. Tests inject a stub. */
    transport?: Transport;
    /**
     * Optional logos fetcher override. Tests inject a stub here; production
     * falls back to `globalThis.fetch`. The `/v1/logos/{carrier}` endpoint
     * returns binary, which the string-bodied {@link Transport} can't carry —
     * logos therefore uses a dedicated facade injected via this option.
     */
    logosFetch?: LogosFetch;
}
/** Optional transport/facade overrides accepted by `Isa` factories. */
export interface IsaFactoryOptions {
    /** Base URL override; defaults to the production ZyINS endpoint. */
    baseUrl?: string;
    /** Proxy origin override; defaults to the production proxy endpoint. */
    proxyOrigin?: string;
    /** Optional structured logger. Overrides ISA_LOG=debug auto-detection. */
    logger?: DebugLogger;
    /** Optional log sink; tests inject a stub. */
    logSink?: LogSink;
    /**
     * Optional logos fetcher override. Tests inject a stub here; production
     * falls back to `globalThis.fetch`.
     */
    logosFetch?: LogosFetch;
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
    /**
     * `isa.account.*` — per-license account operations (branding, preferences,
     * cases, email, reference-data). License-HMAC auth path; constructed only
     * when the identity is a license. Bearer / session callers receive an
     * accessor that throws `IsaConfigError` on first use, matching the zyins
     * namespace pattern.
     */
    readonly account: AccountNamespace;
    /** Top-level webhook verifier. */
    readonly webhooks: WebhooksService;
    /**
     * Shared credential state for license-mode `Isa` instances. Mutated in
     * place by `isa.zyins.licenses.activate()`; `undefined` for bearer /
     * session identities.
     */
    readonly credentialState: IsaCredentialState | undefined;
    private constructor();
    /** Subscribe to `onLicenseRefreshed` after construction. */
    onLicenseRefreshed(listener: LicenseRefreshedListener): () => void;
    /**
     * Construct from a bearer token (server-to-server `isa_live_…` tokens).
     * With no arguments, reads `ISA_TOKEN` from the environment. Throws
     * `IsaConfigError` when neither is supplied.
     */
    static withBearer(args?: {
        token?: string;
    }, env?: EnvReader, options?: IsaFactoryOptions): Isa;
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
        licenseKey?: string;
        credentialStore?: CredentialStore;
        onLicenseRefreshed?: LicenseRefreshedListener;
        transport?: Transport;
    }, env?: EnvReader, options?: IsaFactoryOptions): Isa;
    /**
     * Async variant of {@link withLicense}. Probes the credential store for a
     * persisted `deviceId` + `licenseKey` BEFORE constructing the instance so
     * the very first call already has every credential it needs. Use this in
     * runtimes with persistent storage (React Native, browsers) to skip the
     * synchronous-mint fallback and reuse the device id across process boots.
     */
    static withLicenseAsync(args: {
        keycode?: string;
        email?: string;
        deviceId?: string;
        orderId?: string;
        licenseKey?: string;
        credentialStore: CredentialStore;
        onLicenseRefreshed?: LicenseRefreshedListener;
        transport?: Transport;
    }, env?: EnvReader): Promise<Isa>;
    /**
     * Auto-detect mode from environment variables: bearer if `ISA_TOKEN` is
     * set, license if `ISA_LICENSE_KEYCODE` + `ISA_LICENSE_EMAIL` are set,
     * session if `ISA_SESSION_ID` + `ISA_SESSION_SECRET` are set. Throws
     * `IsaConfigError` when no mode matches.
     */
    static fromEnv(env?: EnvReader): Isa;
    /**
     * Construct from a session (id, secret) — embedded forms. With no
     * arguments, reads `ISA_SESSION_ID` and the session-secret env var from
     * the environment.
     */
    static withSession(args?: {
        sessionId?: string;
        sessionSecret?: string;
    }, env?: EnvReader, options?: IsaFactoryOptions): Isa;
}
/** Internal options the zyins namespace needs from its parent `Isa`. */
interface ZyInsNamespaceOptions {
    identity: IsaIdentity;
    baseUrl?: string;
    logger?: DebugLogger;
    /** Shared credential state for license-mode instances. */
    credentialState?: IsaCredentialState;
    /** Transport override; if set the namespace passes it to facades. */
    transport?: Transport;
    /** Optional logos fetcher (binary path; bypasses string-bodied Transport). */
    logosFetch?: LogosFetch;
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
    /** `isa.zyins.branding` — whitelabel lookup. */
    readonly branding: BrandingFacade;
    /** `isa.zyins.preferences` — per-license preferences document. */
    readonly preferences: PreferencesFacade;
    /** `isa.zyins.cases` — case create + share. */
    readonly cases: CasesFacade;
    /**
     * `isa.zyins.email` — transactional email enqueue. Today the only
     * server endpoint is `POST /v1/email/enqueue`; the SDK exposes it as
     * `email.enqueue` so future `list` / `get` RPCs land cleanly.
     */
    readonly email: EmailFacade;
    /**
     * `isa.zyins.prequalify` — callable that runs the prequalify decision
     * from a typed `PrequalifyRequest`. Carries a `legacyBlob` property for
     * consumers (bpp2.0) whose long-standing encoder produces the wire
     * payload directly and would have to restructure their call site to use
     * the typed shape.
     */
    readonly prequalify: PrequalifyCallable;
    /** `isa.zyins.licenses` — license lifecycle (activate / check / deactivate). */
    readonly licenses: LicensesFacade;
    /** `isa.zyins.logos` — carrier-logo asset lookup (public, no auth). */
    readonly logos: LogosFacade;
    constructor(opts: ZyInsNamespaceOptions);
    /** Raw-response sibling of `prequalify`. */
    prequalifyRaw: (request: PrequalifyRequest) => Promise<RawResponseResult<PrequalifyResult>>;
}
/**
 * Shape of `isa.zyins.prequalify` — a callable for the typed prequalify
 * call, plus a `legacyBlob` sub-method that accepts a pre-encoded payload
 * verbatim. Both variants return the same `Envelope<PrequalifyResult>`.
 */
export interface PrequalifyCallable {
    (request: PrequalifyRequest): Promise<Envelope<PrequalifyResult>>;
    /**
     * Run a prequalify call from a pre-encoded payload (bpp2.0's
     * `prepEncObj` / `prepEncObjV2`). The encoded payload is JSON-serialized
     * and POSTed to `/v1/prequalify` verbatim; the server accepts both the
     * typed and the legacy-blob shapes on the same path.
     */
    legacyBlob(request: PrequalifyLegacyBlobRequest): Promise<Envelope<PrequalifyResult>>;
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
/** Default origin for the platform proxy `/v1/call` endpoint. */
export declare const DEFAULT_PROXY_ORIGIN = "https://proxy.isaapi.com";
interface ProxyNamespaceOptions {
    identity: IsaIdentity;
    proxyOrigin: string;
}
/**
 * `isa.proxy.*` — structured invocation against the platform `/v1/call`
 * endpoint. The SDK↔proxy hop is signed with canonical session-credential
 * HMAC (ADR-035 amendment, PR #<this>); the proxy↔downstream hop remains
 * Algosure HMAC and is handled server-side.
 *
 * `proxy.call()` requires a Session identity. Bearer and License callers
 * must exchange credentials for a session first.
 */
export declare class ProxyNamespace {
    private readonly opts;
    constructor(opts: ProxyNamespaceOptions);
    /**
     * Invoke a registered integration through the platform proxy.
     *
     * @throws IsaConfigError when the parent Isa was constructed with a
     *   non-session credential (bearer / license).
     * @throws IsaValidationError when neither or both of integrationUuid /
     *   integrationId are supplied.
     * @throws IsaUnauthorizedError on a 401 from the proxy.
     * @throws IsaIdempotencyConflictError on a 409 idempotency_conflict.
     * @throws IsaApiError on any other non-2xx response.
     */
    call(opts: ProxyCallOptions): Promise<ProxyCallResult>;
}
export {};
//# sourceMappingURL=isa.d.ts.map