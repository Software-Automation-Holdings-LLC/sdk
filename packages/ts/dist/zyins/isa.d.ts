/**
 * `Isa` — the unified SDK facade (SDK_DESIGN.md §3, §5).
 *
 * One client per process, constructed via a factory matching the consumer's
 * auth context. Today the class delegates ZyINS product calls into the
 * existing Tier 3 `ZyInsClient`; over time the namespaces (`isa.zyins.*`,
 * `isa.rapidsign.*`, `isa.account.*`) will absorb the rest of the surface.
 *
 * Phase 1+2 scope (this commit):
 *   - Env-var auto-detection in `withBearer` / `withKeycode`.
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
import { type PrequalifyRequest, type PrequalifyResult } from './prequalify';
import { WebhooksService } from '../rapidsign/webhooks';
import { type ProxyCallOptions, type ProxyCallResult } from '../proxy/call';
import { BrandingFacade, DatasetsFacade, PreferencesFacade, CasesFacade, EmailFacade, LicenseFacade, LogosFacade } from './isaNamespaces';
import { ProductsFacade } from './products';
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
    /** Transport override for the license surface. Tests inject a stub. */
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
    /**
     * Optional transport override. Used by {@link Isa.forForm} for the
     * `/v1/sessions/reissue` exchange; tests inject a stub here so the
     * factory can be exercised without a live HTTP layer.
     */
    transport?: Transport;
}
/**
 * Unified SDK entry point.
 *
 * Construct via a factory. Every factory is async — the license factory
 * probes the credential store before construction, and the others adopt the
 * same shape so the surface is uniform.
 * ```ts
 * const isa = await Isa.withBearer();                 // ISA_TOKEN
 * const isa = await Isa.withKeycode({ credentialStore }); // ISA_LICENSE_*
 * const isa = await Isa.forForm({ formToken });       // embedded-form auth
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
     * place by `isa.zyins.license.activate()`; `undefined` for bearer /
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
     *
     * Async for surface uniformity across every factory; the body is trivial
     * today but the contract leaves room to probe a credential store in a
     * later phase without an API-shape break.
     */
    static withBearer(args?: {
        token?: string;
    }, env?: EnvReader, options?: IsaFactoryOptions): Promise<Isa>;
    /**
     * Construct from a keycode + email (BPP agent tools). With no
     * arguments, reads `ISA_LICENSE_KEYCODE` and `ISA_LICENSE_EMAIL` from the
     * environment.
     *
     * When a `credentialStore` is supplied, the factory probes it for a
     * persisted `deviceId` and `licenseKey` BEFORE constructing the instance
     * so the very first product call already has every credential it needs.
     * Explicit `deviceId` / `licenseKey` args still win.
     *
     * Always async. The factory probes the credential store before
     * construction so the first product call sees a complete credential
     * state — a sync variant would silently skip that probe and make calls
     * fail with `IsaNotActivatedError` even when a valid key was on disk.
     */
    static withKeycode(args?: {
        keycode?: string;
        email?: string;
        deviceId?: string;
        orderId?: string;
        licenseKey?: string;
        credentialStore?: CredentialStore;
        onLicenseRefreshed?: LicenseRefreshedListener;
        transport?: Transport;
    }, env?: EnvReader, options?: IsaFactoryOptions): Promise<Isa>;
    /**
     * Construct from a one-shot form token (embedded eApp forms). The SDK
     * POSTs the token to `/v1/sessions/reissue`, receives a session
     * `{ sessionId, sessionSecret }`, and constructs a session-mode `Isa`
     * internally so the consumer never handles session credentials directly.
     *
     * The reissue endpoint lands server-side per task #98; until then the
     * call shape is anchored on the constant
     * {@link SESSIONS_REISSUE_PATH} so the SDK plumbing is ready.
     *
     * @example
     * ```ts
     * const formToken = form.metadata._isa_form_token;
     * const isa = await Isa.forForm({ formToken });
     * await isa.zyins.prequalify(req);
     * ```
     */
    static forForm(args: {
        formToken: string;
    }, options?: IsaFactoryOptions): Promise<Isa>;
    /**
     * Unified factory dispatching on argument shape — the discoverability-
     * friendly entry point. Named factories ({@link Isa.withKeycode},
     * {@link Isa.withBearer}, {@link Isa.forForm}) remain the canonical
     * primitives; `authenticate` is sugar for callers who do not know which
     * mode they need at compile time.
     *
     * @example
     * ```ts
     * // Keycode (BPP agent tools)
     * await Isa.authenticate({ keycode: 'SDV-HWH-WDD', email: 'a@b.com' });
     * // Bearer (server-to-server)
     * await Isa.authenticate({ token: 'isa_live_…' });
     * // Form token (embedded eApp)
     * await Isa.authenticate({ formToken: '…' });
     * ```
     */
    static authenticate(args: IsaAuthArgs, options?: IsaFactoryOptions): Promise<Isa>;
}
/**
 * Server-side path for the form-token → session exchange. Anchored as a
 * constant so test stubs and the live transport agree on the URL. The
 * endpoint itself lands per task #98 (`account.sessions` surface); the
 * SDK plumbing is wired ahead of the server so consumers can adopt
 * `Isa.forForm` the day it ships.
 */
export declare const SESSIONS_REISSUE_PATH = "/v1/sessions/reissue";
/** Tagless union accepted by {@link Isa.authenticate}. */
export type IsaAuthArgs = {
    keycode: string;
    email: string;
    credentialStore?: CredentialStore;
} | {
    token: string;
} | {
    formToken: string;
};
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
    /** `isa.zyins.datasets` — reference-data bundle for picker UIs. */
    readonly datasets: DatasetsFacade;
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
     * from a typed `PrequalifyRequest`.
     */
    readonly prequalify: PrequalifyCallable;
    /**
     * `isa.zyins.products` — live product catalog built from server datasets.
     * `catalog()` fetches once and memoizes; `refresh()` forces a re-fetch.
     */
    readonly products: ProductsFacade;
    /**
     * `isa.zyins.license` — license lifecycle (activate / check / deactivate).
     *
     * Per the locked-spec surface (post-lock correction #3), this is the
     * canonical singular form. A device has exactly one license.
     */
    readonly license: LicenseFacade;
    /** `isa.zyins.logos` — carrier-logo asset lookup (public, no auth). */
    readonly logos: LogosFacade;
    constructor(opts: ZyInsNamespaceOptions);
    /** Raw-response sibling of `prequalify`. */
    prequalifyRaw: (request: PrequalifyRequest) => Promise<RawResponseResult<PrequalifyResult>>;
}
/**
 * Shape of `isa.zyins.prequalify` — a callable for the typed prequalify
 * call. Returns `Envelope<PrequalifyResult>`.
 */
export interface PrequalifyCallable {
    (request: PrequalifyRequest): Promise<Envelope<PrequalifyResult>>;
}
/** Top-level helper to add `.withRawResponse` siblings ergonomically. */
export interface RawCallable<TArgs extends unknown[], TResult> {
    (...args: TArgs): Promise<Envelope<TResult>>;
    withRawResponse(...args: TArgs): Promise<RawResponseResult<TResult>>;
}
/**
 * Wrap a result in an envelope. Populates both the deprecated bare-name
 * metadata fields (`requestId`, `idempotencyKey`) and the locked-spec
 * underscore-prefixed siblings (`_requestId`, `_idempotencyKey`) so consumers
 * on either convention see the same values.
 */
export declare function wrapEnvelope<T>(data: T, requestId: string, idempotencyKey?: string): Envelope<T>;
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