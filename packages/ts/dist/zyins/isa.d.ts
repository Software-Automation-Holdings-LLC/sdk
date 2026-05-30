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
import { type PrequalifyV2Request, type PrequalifyV2Result } from './prequalify-v2';
import { type PrequalifyV3Request, type PrequalifyV3Result, type QuoteV3Request, type QuoteV3Result } from './prequalify-v3-types';
import { WebhooksService } from '../rapidsign/webhooks';
import { type ProxyCallOptions, type ProxyCallResult } from '../proxy/call';
import { BrandingFacade, DatasetsFacade, PreferencesFacade, CasesFacade, EmailFacade, LicenseFacade, LogosFacade, ReferenceFacade, ReferenceMedicationsFacade, ReferenceConditionsFacade, type Autocorrector, type MatchAlgorithm, type AutocompleteAlgorithm, type DefaultAutocorrectorOptions } from './isaNamespaces';
import { ProductsFacade } from './products';
import { type ClientVersionListener } from './clientVersion';
import { AccountNamespace } from '../account';
import { type IsaApiVersion, type IsaApiVersionOverride, type IsaApiSurface, type IsaCreateOptions } from './isaOptions';
import type { CaseStorage } from './cases/CaseStorage';
/** Constructor options for `Isa`. */
export interface IsaOptions {
    /** Auth identity from one of the three factories. */
    identity: IsaIdentity;
    /** Base URL override; defaults to the production ZyINS endpoint. */
    baseUrl?: string;
    /** Proxy origin override; defaults to the production proxy endpoint. */
    proxyOrigin?: string;
    /**
     * Viewer origin used to assemble case share links (`isa.account.cases`).
     * Defaults to `https://app.isaapi.com`. The SDK appends `/c/<id>#k=<key>`,
     * so the base must NOT include the `/c/` segment. The fragment key never
     * reaches the server; this only controls the host the link points at.
     */
    caseViewerBaseUrl?: string;
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
    /**
     * Consumer-supplied build identifier (typically a short git hash or
     * SDK release tag) used by the client-version negotiation surface. When
     * set, the SDK inspects `X-Client-Current` / `X-Client-Minimum`
     * response headers and fires `onClientVersionMismatch` listeners.
     */
    clientVersion?: string;
    /** Per-call timeout in ms. Defaults to {@link DEFAULT_TIMEOUT_MS}. */
    timeout?: number;
    /**
     * Per-surface API-version override. Surfaces absent from the override
     * fall back to {@link import('./bundledApiVersions').BundledApiVersions}.
     * Surfaced per-call via the `Api-Version` request header, resolved from
     * the request path.
     */
    apiVersion?: IsaApiVersionOverride;
    /** Pluggable case-storage adapter; defaults to {@link ZeroKnowledgeCaseStorage}. */
    caseStorage?: CaseStorage;
    /**
     * Replace the default autocorrector backing
     * `isa.zyins.autocorrector` / `isa.zyins.reference.autocorrector`.
     * Omit for the bundle-bound default that tracks dataset refreshes.
     */
    autocorrector?: Autocorrector;
    /**
     * Replace the default matcher backing `isa.zyins.matcher` and
     * `match()` calls on every reference sub-facade.
     */
    matchAlgorithm?: MatchAlgorithm;
    /**
     * Replace the default ranker backing every reference
     * `autocomplete()` accessor.
     */
    autocompleteAlgorithm?: AutocompleteAlgorithm;
}
/** Optional transport/facade overrides accepted by `Isa` factories. */
export interface IsaFactoryOptions {
    /** Base URL override; defaults to the production ZyINS endpoint. */
    baseUrl?: string;
    /** Viewer origin used to assemble case share links. */
    caseViewerBaseUrl?: string;
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
    /** Consumer-supplied build identifier for client-version negotiation. */
    clientVersion?: string;
    /** Per-call timeout in ms. Defaults to {@link DEFAULT_TIMEOUT_MS}. */
    timeout?: number;
    /**
     * Per-surface API-version override. Surfaces absent from the override
     * fall back to {@link import('./bundledApiVersions').BundledApiVersions}.
     * Immutable per-instance; surfaced via the `Api-Version` request header
     * resolved per-call from the request path.
     */
    apiVersion?: IsaApiVersionOverride;
    /** Pluggable case-storage adapter; defaults to {@link ZeroKnowledgeCaseStorage}. */
    caseStorage?: CaseStorage;
    /** Replace the default autocorrector. */
    autocorrector?: Autocorrector;
    /** Replace the default matcher. */
    matchAlgorithm?: MatchAlgorithm;
    /** Replace the default ranker. */
    autocompleteAlgorithm?: AutocompleteAlgorithm;
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
     * Top-level autocorrector kernel — domain-agnostic.
     * `isa.autocorrector.create({ typoMap })` returns a fresh
     * {@link DefaultAutocorrector} bound to a caller-supplied typo map.
     * For the zyins-bound autocorrector pre-wired to the dataset's
     * spelling table, use `isa.zyins.autocorrector` instead.
     */
    readonly autocorrector: AutocorrectorKernel;
    /**
     * Shared credential state for license-mode `Isa` instances. Mutated in
     * place by `isa.zyins.license.activate()`; `undefined` for bearer /
     * session identities.
     */
    readonly credentialState: IsaCredentialState | undefined;
    /** Consumer-supplied build identifier for client-version negotiation. */
    readonly clientVersion: string | undefined;
    /**
     * Resolved per-surface API-version map for this instance. Immutable;
     * surfaced via the `Api-Version` request header per call, resolved from
     * the request path. Read this to audit which version each surface talks
     * to without inspecting the wire.
     */
    readonly apiVersion: Readonly<Record<IsaApiSurface, IsaApiVersion>>;
    private clientVersionListeners;
    private clientVersionMismatchEmitted;
    private constructor();
    /**
     * Subscribe to client-version mismatch events. The listener fires on the
     * first response that carries `X-Client-Current` / `X-Client-Minimum`
     * headers that disagree with the consumer's claimed {@link clientVersion}.
     *
     * The returned function unsubscribes the listener.
     */
    onClientVersionMismatch(listener: ClientVersionListener): () => void;
    /** Internal — transport wrapper that detects version-skew headers. */
    private wrapTransportForVersion;
    private emitClientVersion;
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
        orderId?: string;
        licenseKey?: string;
        credentialStore?: CredentialStore;
        onLicenseRefreshed?: LicenseRefreshedListener;
        transport?: Transport;
        autocorrector?: Autocorrector;
        matchAlgorithm?: MatchAlgorithm;
        autocompleteAlgorithm?: AutocompleteAlgorithm;
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
    /**
     * Construct from the typed options bag — the recommended path going
     * forward and the form mirrored across the cross-language SDKs.
     *
     * ```ts
     * const isa = await Isa.create({
     *   auth: BearerAuth.fromToken('isa_live_…'),
     *   engine: RemoteEngine.default,
     *   apiVersion: 'v2',
     *   timeout: 30_000,
     * });
     * ```
     *
     * Dispatches to the matching legacy factory (`withBearer` / `withKeycode`
     * / `withSession` / `forForm`) based on the auth supplier's tag, and
     * threads the resolved engine + apiVersion into the underlying options.
     */
    static create(opts: IsaCreateOptions): Promise<Isa>;
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
    /** Resolved per-surface API-version map inherited from the parent `Isa`. */
    apiVersion: Readonly<Record<IsaApiSurface, IsaApiVersion>>;
    baseUrl?: string;
    /** Viewer origin for case share links; forwarded to the client context. */
    caseViewerBaseUrl?: string;
    logger?: DebugLogger;
    /** Shared credential state for license-mode instances. */
    credentialState?: IsaCredentialState;
    /** Transport override; if set the namespace passes it to facades. */
    transport?: Transport;
    /** Optional logos fetcher (binary path; bypasses string-bodied Transport). */
    logosFetch?: LogosFetch;
    /**
     * Optional case-storage override from the parent `Isa`. When omitted the
     * namespace lazily constructs a {@link ZeroKnowledgeCaseStorage} bound
     * to the shared signed-request context.
     */
    caseStorageOverride?: CaseStorage;
    /** Optional autocorrector override (forwarded to `ReferenceFacade`). */
    autocorrector?: Autocorrector;
    /** Optional matcher override (forwarded to `ReferenceFacade`). */
    matchAlgorithm?: MatchAlgorithm;
    /** Optional ranker override (forwarded to `ReferenceFacade`). */
    autocompleteAlgorithm?: AutocompleteAlgorithm;
}
/**
 * Top-level domain-agnostic autocorrector kernel exposed as
 * `isa.autocorrector`. The factory mints a fresh {@link DefaultAutocorrector}
 * bound to a caller-supplied typo map. Domain-bound autocorrectors
 * (e.g. `isa.zyins.autocorrector`) pre-wire the typo map from their
 * dataset bundle.
 */
export interface AutocorrectorKernel {
    /** Construct a domain-agnostic autocorrector from a typo map. */
    create(opts: DefaultAutocorrectorOptions): Autocorrector;
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
    /**
     * `isa.zyins.reference` — typed catalog access. Use `match()` to
     * resolve free text into a `Concept` handle, then call the symmetric
     * accessors (`conditions(sort)` / `medications(sort)`).
     */
    readonly reference: ReferenceFacade;
    /**
     * `isa.zyins.medications` — top-level shortcut to
     * `isa.zyins.reference.medications`. Per the locked SDK syntax
     * (`docs/sdk-syntax-proposal.md`), consumers can call
     * `isa.zyins.medications.match('insulin')` without traversing the
     * `reference` namespace.
     */
    readonly medications: ReferenceMedicationsFacade;
    /**
     * `isa.zyins.conditions` — top-level shortcut to
     * `isa.zyins.reference.conditions`. Mirror of `medications`.
     */
    readonly conditions: ReferenceConditionsFacade;
    /**
     * `isa.zyins.autocorrector` — domain-bound autocorrector, pre-wired to
     * the zyins dataset's `spellingCorrections`. Tracks bundle refreshes
     * automatically: a fresh `datasets.getV3()` swaps the typo map under
     * the same handle.
     *
     * @example
     * ```ts
     * await isa.zyins.datasets.getV3();
     * const fixed = isa.zyins.autocorrector.correct('hyprtension', { mode: 'submit' });
     * ```
     */
    readonly autocorrector: Autocorrector;
    /**
     * `isa.zyins.matcher` — domain-bound matcher used internally by
     * `match()`. Exposed so consumers can match against arbitrary
     * candidate pools.
     */
    readonly matcher: MatchAlgorithm;
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
     * `isa.zyins.prequalify` — runs the prequalify decision against the
     * version pinned on the parent `Isa`. With the default
     * (`BundledApiVersions.prequalify`) this aliases {@link prequalifyV2} and
     * returns `Envelope<PrequalifyV2Result>`. With
     * `apiVersion: { prequalify: 'v1' }` it routes to {@link prequalifyV1};
     * with `apiVersion: { prequalify: 'v3' }` it routes to
     * {@link prequalifyV3}. Narrow on `isa.apiVersion.prequalify` to
     * disambiguate the return shape.
     */
    readonly prequalify: PrequalifyV3Callable | PrequalifyV2Callable | PrequalifyV1Callable;
    /**
     * `isa.zyins.prequalifyV2` — callable that runs the v2 prequalify
     * decision (`POST /v2/prequalify`). Returns one `PlanOffer` per
     * product with the best qualifying tier at the top level and
     * alternates in `other_offers[]`.
     *
     * @deprecated Prefer `isa.zyins.prequalify` (v2 by default). Retained
     * for one release as an alias of the canonical method so existing
     * callers do not break.
     */
    readonly prequalifyV2: PrequalifyV2Callable;
    /**
     * `isa.zyins.prequalifyV1` — legacy callable that hits
     * `POST /v1/prequalify`. Use only when pinned to `apiVersion: 'v1'`.
     */
    readonly prequalifyV1: PrequalifyV1Callable;
    /**
     * `isa.zyins.prequalifyV3` — callable that runs the v3 prequalify
     * decision (`POST /v3/prequalify`). Returns one offer per product with
     * a uniform `pricing[]` table — each row is a rate class carrying its
     * own eligibility, premium, and rank. Array order of `pricing` is
     * authoritative for display. Pin via `apiVersion: { prequalify: 'v3' }`
     * to make `isa.zyins.prequalify` route here.
     */
    readonly prequalifyV3: PrequalifyV3Callable;
    /**
     * `isa.zyins.quote` — runs the quote decision against the version pinned
     * on the parent `Isa`. Pin via `apiVersion: { quote: 'v3' }` to route to
     * {@link quoteV3}; v1/v2 quote facades are not implemented.
     */
    readonly quote: QuoteV3Callable;
    /**
     * `isa.zyins.quoteV3` — callable that runs the v3 quote call
     * (`POST /v3/quote`). Returns qualifying products grouped by requested
     * amount with the same uniform `pricing[]` table as v3 prequalify.
     */
    readonly quoteV3: QuoteV3Callable;
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
    /** Raw-response sibling of {@link prequalify}; follows the pinned API version. */
    prequalifyRaw: (request: PrequalifyRequest | PrequalifyV2Request | PrequalifyV3Request) => Promise<RawResponseResult<PrequalifyResult | PrequalifyV2Result | PrequalifyV3Result>>;
    /** Raw-response sibling of `prequalifyV2`. */
    prequalifyV2Raw: (request: PrequalifyV2Request) => Promise<RawResponseResult<PrequalifyV2Result>>;
    /** Raw-response sibling of `prequalifyV3`. */
    prequalifyV3Raw: (request: PrequalifyV3Request) => Promise<RawResponseResult<PrequalifyV3Result>>;
    /** Raw-response sibling of `quoteV3`. */
    quoteV3Raw: (request: QuoteV3Request) => Promise<RawResponseResult<QuoteV3Result>>;
}
/**
 * Shape of the v1 prequalify callable (`POST /v1/prequalify`). Returns
 * `Envelope<PrequalifyResult>`.
 *
 * @deprecated The legacy v1 envelope shape disagrees with what the
 * documented examples describe. Pin `apiVersion: 'v2'` (default) and
 * call {@link PrequalifyV2Callable} instead.
 */
export interface PrequalifyV1Callable {
    (request: PrequalifyRequest): Promise<Envelope<PrequalifyResult>>;
}
/**
 * @deprecated Renamed to {@link PrequalifyV1Callable}. Retained as an
 * alias for one release so existing callers keep compiling.
 */
export type PrequalifyCallable = PrequalifyV1Callable;
/**
 * Shape of `isa.zyins.prequalifyV2` — a callable for the typed v2
 * prequalify call. Returns `Envelope<PrequalifyV2Result>`.
 */
export interface PrequalifyV2Callable {
    (request: PrequalifyV2Request): Promise<Envelope<PrequalifyV2Result>>;
}
/**
 * Shape of `isa.zyins.prequalifyV3` — a callable for the typed v3
 * prequalify call. Returns `Envelope<PrequalifyV3Result>`.
 */
export interface PrequalifyV3Callable {
    (request: PrequalifyV3Request): Promise<Envelope<PrequalifyV3Result>>;
}
/**
 * Shape of `isa.zyins.quoteV3` — a callable for the typed v3 quote call.
 * Returns `Envelope<QuoteV3Result>`.
 */
export interface QuoteV3Callable {
    (request: QuoteV3Request): Promise<Envelope<QuoteV3Result>>;
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
export declare function wrapEnvelope<T>(data: T, requestId: string, idempotencyKey?: string, livemode?: boolean, retryAttempts?: number): Envelope<T>;
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