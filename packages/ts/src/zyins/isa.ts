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
 *   - Every method exposes a `*Raw` sibling (e.g. `prequalifyRaw`)
 *     returning `{ data, response }` where `response` carries
 *     status/headers/url.
 *   - `Envelope<T>` carries typed `requestId`, `idempotencyKey`,
 *     `retryAttempts` named fields.
 *
 * Concurrency: the client carries no shared mutable state. Multiple in-
 * flight calls on one instance are safe (see README "Concurrency safety").
 */

import { DEFAULT_CASE_VIEWER_BASE_URL } from "../account/cases.js";
import { buildAccountNamespace } from "../account/factory.js";
import { AccountNamespace } from "../account/index.js";
import { CREDENTIAL_KEYS, type CredentialStore, inMemoryCredentialStore, loadOrMintDeviceId } from "../core/index.js";
import {
  assertSessionIdentityForProxyCall,
  proxyCall as runProxyCall,
  type ProxyCallOptions,
  type ProxyCallResult,
} from "../proxy/call.js";
import { WebhooksService } from "../rapidsign/webhooks.js";
import {
  type IsaApiError,
  IsaConfigError,
  type IsaIdempotencyConflictError,
  IsaNotActivatedError,
  isApiError,
  IsaTimeoutError,
  isIdempotencyConflictError,
  isNotActivatedError,
} from "./apiError.js";
import { type AuthContext } from "./auth.js";
import { surfaceForPath } from "./bundledApiVersions.js";
import type { CaseStorage } from "./cases/CaseStorage.js";
import { ZeroKnowledgeCaseStorage } from "./cases/ZeroKnowledgeCaseStorage.js";
import { DEFAULT_ZYINS_BASE_URL, ZyInsClient, type ZyInsClientOptions } from "./client.js";
import { type ClientVersionListener, type ClientVersionStatus, evaluateClientVersion } from "./clientVersion.js";
import { IsaCredentialState, type LicenseRefreshedListener } from "./credentialState.js";
import { ApiDatasetSource, type DatasetSource, type DatasetSourceInput, toDatasetSource } from "./datasetSource.js";
import { type Envelope, type RawResponse, type RawResponseResult } from "./envelope.js";
import {
  ENV_VAR_NAMES,
  type IsaIdentity,
  type LicenseIdentity,
  resolveBearerIdentityOrOffline,
  resolveLicenseIdentity,
  resolveSessionIdentity,
} from "./envFactory.js";
import {
  type AutocompleteAlgorithm,
  type Autocorrector,
  BrandingFacade,
  CasesFacade,
  DatasetsFacade,
  DefaultAutocorrector,
  type DefaultAutocorrectorOptions,
  EmailFacade,
  LicenseFacade,
  LogosFacade,
  type MatchAlgorithm,
  PreferencesFacade,
  ReferenceBundleCache,
  ReferenceConditionsFacade,
  ReferenceFacade,
  ReferenceMedicationsFacade,
} from "./isaNamespaces.js";
import {
  DEFAULT_TIMEOUT_MS,
  type IsaApiSurface,
  type IsaApiVersion,
  type IsaApiVersionOverride,
  type IsaAuthSupplier,
  type IsaCreateOptions,
  resolveApiVersions,
  type ResolvedIsaOptions,
  resolveIsaOptions,
} from "./isaOptions.js";
import {
  type DebugLogger,
  debugLoggerFromEnv,
  type EnvReader,
  type LogSink,
  processEnv,
  stderrSink,
} from "./logger.js";
import { type LogosFetch } from "./logos.js";
import { type PrequalifyV2Request, type PrequalifyV2Result } from "./prequalify-v2.js";
import {
  type PrequalifyV3Request,
  type PrequalifyV3Result,
  type QuoteV3Request,
  type QuoteV3Result,
} from "./prequalify-v3-types.js";
import { type PrequalifyRequest, type PrequalifyResult } from "./prequalify.js";
import { ProductsFacade } from "./products.js";
import { bearerSigner, type RequestSigner, sessionCredentialSigner } from "./requestSigner.js";
import { SDK_RETRY_ATTEMPTS_HEADER } from "./retryAttempts.js";
import { sessionSigner } from "./sessionSigner.js";
import { defaultTransport, type Transport } from "./transport.js";

/** Constructor options for `Isa`. */
export interface IsaOptions {
  /** Auth identity from one of the three factories. */
  identity: IsaIdentity;
  /** Base URL override; defaults to the production ZyINS endpoint. */
  baseUrl?: string;
  /**
   * Account-service origin override for the license-mode session
   * bootstrap (see `sessionSigner.ts`); defaults to the production
   * account service. Point this at a local double for tests/staging —
   * isa-mock does not itself serve `/v1/sessions`.
   */
  accountBaseUrl?: string;
  /** Proxy origin override; defaults to the production proxy endpoint. */
  proxyOrigin?: string;
  /**
   * Viewer origin used to assemble case share links (`isa.account.cases`).
   * Defaults to `https://link.isaapi.com`. The SDK appends `/<code>#k=<key>`;
   * any product prefix rides inside this base URL. The fragment key never
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
   * fall back to {@link import('./bundledApiVersions.js').BundledApiVersions}.
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
  /**
   * Explicit reference-bundle source. A string is a local file path; a
   * {@link DatasetBundleV3} is used directly; a {@link DatasetSource} is
   * used as given. When set, the reference layer warms from it at factory
   * time and `conditions.match(...)` resolves offline. Omitted keeps the
   * unchanged API-fetch default.
   */
  datasets?: DatasetSourceInput;
}

/** Optional transport/facade overrides accepted by `Isa` factories. */
export interface IsaFactoryOptions {
  /** Base URL override; defaults to the production ZyINS endpoint. */
  baseUrl?: string;
  /**
   * Account-service origin override for the license-mode session
   * bootstrap; defaults to the production account service. See
   * {@link IsaOptions.accountBaseUrl}.
   */
  accountBaseUrl?: string;
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
   * `/v1/sessions` FormToken mint; tests inject a stub here so the
   * factory can be exercised without a live HTTP layer.
   */
  transport?: Transport;
  /** Consumer-supplied build identifier for client-version negotiation. */
  clientVersion?: string;
  /** Per-call timeout in ms. Defaults to {@link DEFAULT_TIMEOUT_MS}. */
  timeout?: number;
  /**
   * Per-surface API-version override. Surfaces absent from the override
   * fall back to {@link import('./bundledApiVersions.js').BundledApiVersions}.
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
  /**
   * Explicit reference-bundle source (file path, bundle, or
   * {@link DatasetSource}). When set, the reference layer warms from it at
   * factory time; omitted keeps the API-fetch default.
   */
  datasets?: DatasetSourceInput;
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
export class Isa {
  /** The resolved auth identity. */
  public readonly identity: IsaIdentity;
  /** Active debug logger, if `ISA_LOG=debug` or one was injected. */
  public readonly logger: DebugLogger | undefined;
  /** Product namespaces. */
  public readonly zyins: ZyInsNamespace;
  /** RapidSign namespace — typed surface; live methods land with issue #38. */
  public readonly rapidsign: RapidSignNamespace;
  /** Proxy namespace — internal-facing; transport composition only. */
  public readonly proxy: ProxyNamespace;
  /**
   * `isa.account.*` — per-license account operations (branding, preferences,
   * cases, email, reference-data). License-HMAC auth path; constructed only
   * when the identity is a license. Bearer / session callers receive an
   * accessor that throws `IsaConfigError` on first use, matching the zyins
   * namespace pattern.
   */
  public readonly account: AccountNamespace;
  /** Top-level webhook verifier. */
  public readonly webhooks: WebhooksService;
  /**
   * Top-level autocorrector kernel — domain-agnostic.
   * `isa.autocorrector.create({ typoMap })` returns a fresh
   * {@link DefaultAutocorrector} bound to a caller-supplied typo map.
   * For the zyins-bound autocorrector pre-wired to the dataset's
   * spelling table, use `isa.zyins.autocorrector` instead.
   */
  public readonly autocorrector: AutocorrectorKernel = AUTOCORRECTOR_KERNEL;
  /**
   * Shared credential state for license-mode `Isa` instances. Mutated in
   * place by `isa.zyins.license.activate()`; `undefined` for bearer /
   * session identities.
   */
  public readonly credentialState: IsaCredentialState | undefined;

  /** Consumer-supplied build identifier for client-version negotiation. */
  public readonly clientVersion: string | undefined;
  /**
   * Resolved per-surface API-version map for this instance. Immutable;
   * surfaced via the `Api-Version` request header per call, resolved from
   * the request path. Read this to audit which version each surface talks
   * to without inspecting the wire.
   */
  public readonly apiVersion: Readonly<Record<IsaApiSurface, IsaApiVersion>>;
  private clientVersionListeners: ClientVersionListener[] = [];
  private clientVersionMismatchEmitted = false;

  private constructor(opts: IsaOptions) {
    this.identity = opts.identity;
    this.clientVersion = opts.clientVersion;
    this.apiVersion = resolveApiVersions(opts.apiVersion);
    this.logger = opts.logger
      ?? debugLoggerFromEnv(opts.env ?? processEnv, opts.logSink ?? stderrSink);
    this.credentialState = buildCredentialStateIfLicense(opts);
    if (this.credentialState && opts.onLicenseRefreshed) {
      this.credentialState.onLicenseRefreshed(opts.onLicenseRefreshed);
    }
    const baseTransport = wrapTransportTimeout(
      opts.transport ?? defaultTransport(),
      opts.timeout ?? DEFAULT_TIMEOUT_MS,
    );
    const versionPinned = wrapTransportPinApiVersion(baseTransport, this.apiVersion);
    const conflictRetried = wrapTransportIdempotencyRetry(versionPinned);
    const wrappedTransport = this.clientVersion
      ? this.wrapTransportForVersion(conflictRetried)
      : conflictRetried;
    const nsOpts: ZyInsNamespaceOptions = {
      identity: opts.identity,
      apiVersion: this.apiVersion,
    };
    if (opts.baseUrl !== undefined) nsOpts.baseUrl = opts.baseUrl;
    if (opts.accountBaseUrl !== undefined) nsOpts.accountBaseUrl = opts.accountBaseUrl;
    if (opts.caseViewerBaseUrl !== undefined) nsOpts.caseViewerBaseUrl = opts.caseViewerBaseUrl;
    if (this.logger !== undefined) nsOpts.logger = this.logger;
    if (this.credentialState !== undefined) nsOpts.credentialState = this.credentialState;
    nsOpts.transport = wrappedTransport;
    if (opts.logosFetch !== undefined) nsOpts.logosFetch = opts.logosFetch;
    nsOpts.caseStorageOverride = opts.caseStorage;
    if (opts.autocorrector !== undefined) nsOpts.autocorrector = opts.autocorrector;
    if (opts.matchAlgorithm !== undefined) nsOpts.matchAlgorithm = opts.matchAlgorithm;
    if (opts.autocompleteAlgorithm !== undefined) {
      nsOpts.autocompleteAlgorithm = opts.autocompleteAlgorithm;
    }
    if (opts.datasets !== undefined) {
      nsOpts.datasetSource = toDatasetSource(opts.datasets);
    }
    this.zyins = new ZyInsNamespace(nsOpts);
    this.webhooks = new WebhooksService();
    this.rapidsign = new RapidSignNamespace(this.webhooks);
    this.proxy = new ProxyNamespace({
      identity: opts.identity,
      proxyOrigin: opts.proxyOrigin ?? DEFAULT_PROXY_ORIGIN,
    });
    this.account = buildAccountNamespace({
      identity: opts.identity,
      ...(opts.baseUrl !== undefined && { baseUrl: opts.baseUrl }),
      ...(opts.deviceId !== undefined && { deviceId: opts.deviceId }),
      ...(opts.orderId !== undefined && { orderId: opts.orderId }),
      ...(opts.caseViewerBaseUrl !== undefined && { caseViewerBaseUrl: opts.caseViewerBaseUrl }),
      ...(this.credentialState !== undefined && { credentialState: this.credentialState }),
      transport: wrappedTransport,
    });
  }

  /**
   * Subscribe to client-version mismatch events. The listener fires on the
   * first response that carries `X-Client-Current` / `X-Client-Minimum`
   * headers that disagree with the consumer's claimed {@link clientVersion}.
   *
   * The returned function unsubscribes the listener.
   */
  onClientVersionMismatch(listener: ClientVersionListener): () => void {
    this.clientVersionListeners.push(listener);
    return () => {
      this.clientVersionListeners = this.clientVersionListeners.filter(
        (l) => l !== listener,
      );
    };
  }

  /** Internal — transport wrapper that detects version-skew headers. */
  private wrapTransportForVersion(inner: Transport): Transport {
    return async (request) => {
      const response = await inner(request);
      const status = evaluateClientVersion(response.headers, this.clientVersion);
      if (status && !this.clientVersionMismatchEmitted) {
        this.clientVersionMismatchEmitted = true;
        this.emitClientVersion(status);
      }
      return response;
    };
  }

  private emitClientVersion(status: ClientVersionStatus): void {
    for (const l of this.clientVersionListeners) {
      try {
        l(status);
      } catch {
        // Listener errors must not propagate into transport calls.
      }
    }
  }

  /** Subscribe to `onLicenseRefreshed` after construction. */
  onLicenseRefreshed(listener: LicenseRefreshedListener): () => void {
    if (!this.credentialState) {
      throw new IsaConfigError(
        "Isa.onLicenseRefreshed is available only on license-mode instances",
      );
    }
    return this.credentialState.onLicenseRefreshed(listener);
  }

  /**
   * Construct from a bearer token (server-to-server `isa_live_…` tokens).
   * With no arguments, reads `ISA_TOKEN` from the environment. Throws
   * `IsaConfigError` when neither is supplied.
   *
   * When `options.datasets` supplies a local reference-bundle source, the
   * token requirement is relaxed: the reference layer (`conditions.match`,
   * `medications.match`, autocomplete, fuzzy, autocorrect) works fully
   * offline, so no credential is needed. The factory warms the reference
   * index from the source before resolving — the first synchronous
   * `match()` already sees a primed catalog. Product calls in that mode
   * still require a token and fail loud if one was never supplied.
   *
   * Async for surface uniformity across every factory; the body also awaits
   * the offline bundle warm-up when a local `datasets` source is set.
   */
  static async withBearer(
    args?: { token?: string },
    env: EnvReader = processEnv,
    options: IsaFactoryOptions = {},
  ): Promise<Isa> {
    const identity = resolveBearerIdentityOrOffline(args, env, options.datasets !== undefined);
    const isa = new Isa({ identity, ...options });
    await isa.zyins.warmReferenceBundle();
    return isa;
  }

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
  static async withKeycode(
    args?: {
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
    },
    env: EnvReader = processEnv,
    options: IsaFactoryOptions = {},
  ): Promise<Isa> {
    const identity = resolveLicenseIdentity(args, env);
    // Resolve credentials BEFORE construction so the very first product call
    // sees a complete credential state. `deviceId` is SDK-internal — never
    // a constructor argument (see docs/sdk-syntax-proposal.md §2.8). The
    // factory derives it from the credential store or mints a fresh one
    // and persists it; the supplied store fronts the lifetime, an in-memory
    // store backs the process when no store is supplied.
    const store = args?.credentialStore ?? inMemoryCredentialStore();
    const deviceId = await loadOrMintDeviceId(store);
    const licenseKey = args?.licenseKey ?? (await store.get(CREDENTIAL_KEYS.licenseKey));

    const opts: IsaOptions = { identity, ...options };
    opts.deviceId = deviceId;
    if (args?.orderId !== undefined) opts.orderId = args.orderId;
    if (licenseKey !== undefined) opts.licenseKey = licenseKey;
    opts.credentialStore = store;
    if (args?.onLicenseRefreshed !== undefined) opts.onLicenseRefreshed = args.onLicenseRefreshed;
    if (args?.transport !== undefined) opts.transport = args.transport;
    if (args?.autocorrector !== undefined) opts.autocorrector = args.autocorrector;
    if (args?.matchAlgorithm !== undefined) opts.matchAlgorithm = args.matchAlgorithm;
    if (args?.autocompleteAlgorithm !== undefined) {
      opts.autocompleteAlgorithm = args.autocompleteAlgorithm;
    }
    const isa = new Isa(opts);
    await isa.zyins.warmReferenceBundle();
    return isa;
  }

  /**
   * Construct from an already-minted session (id, secret) — the credential
   * an embedded app is handed after the embed host redeems its launch code.
   * Product calls are signed with that session as-is; the SDK never mints,
   * renews, or persists it. External consumers reach this through
   * `Isa.create({ auth: SessionAuth.fromSession(...) })`.
   */
  static async withSession(
    args?: { sessionId?: string; sessionSecret?: string },
    env: EnvReader = processEnv,
    options: IsaFactoryOptions = {},
  ): Promise<Isa> {
    const isa = new Isa({ identity: resolveSessionIdentity(args, env), ...options });
    await isa.zyins.warmReferenceBundle();
    return isa;
  }

  /**
   * Construct from a one-shot form token (embedded eApp forms). The SDK
   * POSTs the token to {@link SESSIONS_PATH} (`POST /v1/sessions`) with
   * `Authorization: FormToken <token>`, receives a session
   * `{ sessionId, sessionSecret }`, and constructs a session-mode `Isa`
   * internally so the consumer never handles session credentials directly.
   *
   * Session rotation (after mint) is {@link SESSIONS_REISSUE_PATH} with
   * `Authorization: Session <secret>` + `X-Isa-Session-Id` — FormToken is
   * mint-only (account ADR-037).
   *
   * Note: the resulting `Isa` is session-mode — `zyins` product calls are
   * signed with the minted session as-is (see {@link Isa.withSession}); the
   * session is not renewed.
   *
   * @example
   * ```ts
   * const formToken = form.metadata._isa_form_token;
   * const isa = await Isa.forForm({ formToken });
   * ```
   */
  static async forForm(
    args: { formToken: string },
    options: IsaFactoryOptions = {},
  ): Promise<Isa> {
    if (!args?.formToken || args.formToken.length === 0) {
      throw new IsaConfigError(
        "Isa.forForm: formToken is required (typically read from form.metadata._isa_form_token)",
      );
    }
    const baseUrl = options.baseUrl ?? DEFAULT_ZYINS_BASE_URL;
    const transport = wrapTransportTimeout(
      options.transport ?? defaultTransport(),
      options.timeout ?? DEFAULT_TIMEOUT_MS,
    );
    const mintUrl = `${baseUrl.replace(/\/$/, "")}${SESSIONS_PATH}`;
    const response = await transport({
      method: "POST",
      url: mintUrl,
      headers: {
        "Content-Type": "application/json",
        Authorization: `FormToken ${args.formToken}`,
      },
      body: "{}",
    });
    if (response.status < 200 || response.status >= 300) {
      throw new IsaConfigError(
        `Isa.forForm: ${SESSIONS_PATH} returned ${response.status}; expected 2xx`,
      );
    }
    const { sessionId, sessionSecret } = parseSessionMintResponse(response.body);
    const isa = new Isa({
      identity: { mode: "session", sessionId, sessionSecret },
      ...options,
    });
    await isa.zyins.warmReferenceBundle();
    return isa;
  }

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
  static async authenticate(
    args: IsaAuthArgs,
    options?: IsaFactoryOptions,
  ): Promise<Isa> {
    if (isKeycodeAuthArgs(args)) {
      return Isa.withKeycode(args, processEnv, options ?? {});
    }
    if (isBearerAuthArgs(args)) {
      return Isa.withBearer(args, processEnv, options ?? {});
    }
    if (isFormAuthArgs(args)) {
      return Isa.forForm(args, options ?? {});
    }
    throw new IsaConfigError(
      "Isa.authenticate: argument did not match any auth mode (expected {keycode, email}, {token}, or {formToken})",
    );
  }

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
  static async create(opts: IsaCreateOptions): Promise<Isa> {
    const resolved = resolveIsaOptions(opts);
    return constructFromCreateOptions(resolved);
  }

  /**
   * Auto-detect mode from environment variables: bearer if `ISA_TOKEN` is
   * set, keycode if `ISA_LICENSE_KEYCODE` + `ISA_LICENSE_EMAIL` are set.
   * Throws `IsaConfigError` when no mode matches.
   *
   * Sessions are not advertised as a public auth mode (see
   * {@link Isa.withSession} `@internal`); the env-driven path therefore
   * does not auto-bootstrap a session.
   */
  static async fromEnv(env: EnvReader = processEnv): Promise<Isa> {
    if (env.get(ENV_VAR_NAMES.bearer.token)) return Isa.withBearer(undefined, env);
    if (env.get(ENV_VAR_NAMES.license.keycode) && env.get(ENV_VAR_NAMES.license.email)) {
      return Isa.withKeycode(undefined, env);
    }
    throw new IsaConfigError(
      `Isa.fromEnv: no recognized credential in environment (set ${ENV_VAR_NAMES.bearer.token}, or ${ENV_VAR_NAMES.license.keycode} + ${ENV_VAR_NAMES.license.email})`,
    );
  }

  /**
   * Prototype-independent guard for {@link IsaApiError}. Use this instead of
   * `instanceof IsaApiError` — `instanceof` breaks when the error crossed a
   * module boundary that produced a second copy of the class (vendored
   * tarball, test mock, duplicated dependency). Mirrors Stripe's
   * `Stripe.errors.StripeError.isStripeError`.
   *
   * @example
   * ```ts
   * try {
   *   await isa.zyins.prequalify(req);
   * } catch (e) {
   *   if (Isa.isApiError(e)) console.error(e.code, e.status, e.requestId);
   * }
   * ```
   */
  static isApiError(value: unknown): value is IsaApiError {
    return isApiError(value);
  }

  /**
   * Prototype-independent guard for {@link IsaNotActivatedError}. Narrows so
   * the caller can branch on `code` and re-activate the license.
   *
   * @example
   * ```ts
   * if (Isa.isNotActivatedError(e)) await isa.zyins.license.activate();
   * ```
   */
  static isNotActivatedError(value: unknown): value is IsaNotActivatedError {
    return isNotActivatedError(value);
  }

  /**
   * Prototype-independent guard for {@link IsaIdempotencyConflictError}.
   * Narrows so the caller can read `key` / `firstSeenAt`.
   *
   * @example
   * ```ts
   * if (Isa.isIdempotencyConflictError(e)) console.warn(e.key, e.firstSeenAt);
   * ```
   */
  static isIdempotencyConflictError(
    value: unknown,
  ): value is IsaIdempotencyConflictError {
    return isIdempotencyConflictError(value);
  }
}

/**
 * Public mint path for sessions — license HMAC bootstrap and FormToken
 * form mint share this route (account ADR-037). Anchored as a constant so
 * test stubs and the live transport agree on the URL.
 */
export const SESSIONS_PATH = "/v1/sessions";

/**
 * Session rotation path. Requires `Authorization: Session <secret>` +
 * `X-Isa-Session-Id`. FormToken is rejected here (mint at {@link SESSIONS_PATH}).
 */
export const SESSIONS_REISSUE_PATH = "/v1/sessions/reissue";

/** Tagless union accepted by {@link Isa.authenticate}. */
export type IsaAuthArgs =
  | { keycode: string; email: string; credentialStore?: CredentialStore }
  | { token: string }
  | { formToken: string };

function isKeycodeAuthArgs(
  args: IsaAuthArgs,
): args is { keycode: string; email: string; credentialStore?: CredentialStore } {
  return (
    typeof (args as { keycode?: unknown }).keycode === "string"
    && typeof (args as { email?: unknown }).email === "string"
  );
}

function isBearerAuthArgs(args: IsaAuthArgs): args is { token: string } {
  return typeof (args as { token?: unknown }).token === "string";
}

function isFormAuthArgs(args: IsaAuthArgs): args is { formToken: string } {
  return typeof (args as { formToken?: unknown }).formToken === "string";
}

/**
 * Parse a session mint/reissue response body. The server returns a
 * standard envelope with `data: { sessionId, sessionSecret }` (camelCase
 * on account handlers; snake_case tolerated for older fixtures).
 */
function parseSessionMintResponse(body: string): {
  sessionId: string;
  sessionSecret: string;
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new IsaConfigError(
      `Isa.forForm: ${SESSIONS_PATH} returned non-JSON body`,
    );
  }
  const data = (parsed as { data?: unknown }).data ?? parsed; // tolerate envelope OR bare object
  const sessionId = (data as { sessionId?: unknown; session_id?: unknown }).sessionId
    ?? (data as { session_id?: unknown }).session_id;
  const sessionSecret = (data as { sessionSecret?: unknown; session_secret?: unknown }).sessionSecret
    ?? (data as { session_secret?: unknown }).session_secret;
  if (typeof sessionId !== "string" || typeof sessionSecret !== "string") {
    throw new IsaConfigError(
      `Isa.forForm: ${SESSIONS_PATH} response missing sessionId/sessionSecret`,
    );
  }
  return { sessionId, sessionSecret };
}

/** Internal options the zyins namespace needs from its parent `Isa`. */
interface ZyInsNamespaceOptions {
  identity: IsaIdentity;
  /** Resolved per-surface API-version map inherited from the parent `Isa`. */
  apiVersion: Readonly<Record<IsaApiSurface, IsaApiVersion>>;
  baseUrl?: string;
  /** Account-service origin for the license-mode session bootstrap. */
  accountBaseUrl?: string;
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
  /**
   * Optional explicit reference-bundle source. When set, the namespace
   * loads the bundle from it and warms the reference index at factory time
   * — `isa.zyins.conditions.match(...)` then resolves with no network. When
   * omitted, the reference index stays warmed only by `datasets.get()` (the
   * unchanged API default).
   */
  datasetSource?: DatasetSource;
}

/**
 * Top-level domain-agnostic autocorrector kernel exposed as
 * `isa.autocorrector`. The factory mints a fresh {@link DefaultAutocorrector}
 * bound to a caller-supplied typo map. Domain-bound autocorrectors
 * (e.g. `isa.zyins.autocorrector`) pre-wire the typo map from their
 * dataset bundle.
 */
export interface AutocorrectorKernel {
  /**
   * Construct a domain-agnostic autocorrector from a typo map. Returns the
   * concrete {@link DefaultAutocorrector} so callers reach `versionTag` and
   * `clone()` — the staleness-detection and map-swap surface — not just the
   * narrow {@link Autocorrector.correct} method.
   */
  create(opts: DefaultAutocorrectorOptions): DefaultAutocorrector;
}

const AUTOCORRECTOR_KERNEL: AutocorrectorKernel = {
  create: (opts) => new DefaultAutocorrector(opts),
};

/**
 * `isa.zyins.*` — methods for the ZyINS product. Each method has a
 * `*Raw` sibling (e.g. `prequalifyRaw`) returning `{ data, response }`.
 *
 * Bearer and session-mode product calls are reserved for a follow-up phase
 * (transport wiring exists in @isa-sdk/core; the namespace stub raises a
 * clear `IsaConfigError` if invoked before that phase lands).
 */
export class ZyInsNamespace {
  private readonly opts: ZyInsNamespaceOptions;
  private readonly clientOnce: () => ZyInsClient;
  private readonly referenceBundleCache: ReferenceBundleCache;
  private readonly datasetSource: DatasetSource | undefined;
  /** `isa.zyins.branding` — whitelabel lookup. */
  public readonly branding: BrandingFacade;
  /** `isa.zyins.datasets` — reference-data bundle for picker UIs. */
  public readonly datasets: DatasetsFacade;
  /**
   * `isa.zyins.reference` — typed catalog access. Use `match()` to
   * resolve free text into a `Concept` handle, then call the symmetric
   * accessors (`conditions(sort)` / `medications(sort)`).
   */
  public readonly reference: ReferenceFacade;
  /**
   * `isa.zyins.medications` — top-level shortcut to
   * `isa.zyins.reference.medications`. Per the locked SDK syntax
   * (`docs/sdk-syntax-proposal.md`), consumers can call
   * `isa.zyins.medications.match('insulin')` without traversing the
   * `reference` namespace.
   */
  public readonly medications: ReferenceMedicationsFacade;
  /**
   * `isa.zyins.conditions` — top-level shortcut to
   * `isa.zyins.reference.conditions`. Mirror of `medications`.
   */
  public readonly conditions: ReferenceConditionsFacade;
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
  public readonly autocorrector: Autocorrector;
  /**
   * `isa.zyins.matcher` — domain-bound matcher used internally by
   * `match()`. Exposed so consumers can match against arbitrary
   * candidate pools.
   */
  public readonly matcher: MatchAlgorithm;
  /** `isa.zyins.preferences` — per-license preferences document. */
  public readonly preferences: PreferencesFacade;
  /** `isa.zyins.cases` — case create + share. */
  public readonly cases: CasesFacade;
  /**
   * `isa.zyins.email` — transactional email enqueue. Today the only
   * server endpoint is `POST /v1/email/enqueue`; the SDK exposes it as
   * `email.enqueue` so future `list` / `get` RPCs land cleanly.
   */
  public readonly email: EmailFacade;
  /**
   * `isa.zyins.prequalify` — runs the prequalify decision against the
   * version pinned on the parent `Isa`. Typed as {@link PrequalifyV3Callable}
   * because the bundled default (`BundledApiVersions.prequalify`) is `v3`:
   * the de-versioned surface accepts a {@link PrequalifyV3Request} and
   * returns `Envelope<PrequalifyV3Result>`, so V3-only fields
   * (`pricing[]`, `deathBenefit`) type-check without narrowing.
   *
   * Pinning `apiVersion: { prequalify: 'v2' }` (or `'v1'`) re-routes the
   * runtime call to the legacy decision; those callers should use the
   * explicit {@link prequalifyV2} / {@link prequalifyV1} escape hatches,
   * whose return types match the legacy wire shape.
   */
  public readonly prequalify: PrequalifyV3Callable;
  /**
   * `isa.zyins.prequalifyV2` — callable that runs the v2 prequalify
   * decision (`POST /v2/prequalify`). Returns one `PlanOffer` per
   * product with the best qualifying tier at the top level and
   * alternates in `other_offers[]`.
   *
   * @deprecated Prefer `isa.zyins.prequalify` (v3 by default), or pin
   * `apiVersion: { prequalify: 'v2' }` when the legacy v2 shape is required.
   * Retained as an explicit callable so existing callers do not break.
   */
  public readonly prequalifyV2: PrequalifyV2Callable;
  /**
   * `isa.zyins.prequalifyV1` — legacy callable that hits
   * `POST /v1/prequalify`. Use only when pinned to `apiVersion: 'v1'`.
   */
  public readonly prequalifyV1: PrequalifyV1Callable;
  /**
   * `isa.zyins.prequalifyV3` — callable that runs the v3 prequalify
   * decision (`POST /v3/prequalify`). Returns one offer per product with
   * a uniform `pricing[]` table — each row is a rate class carrying its
   * own eligibility, premium, and rank. Array order of `pricing` is
   * authoritative for display. Pin via `apiVersion: { prequalify: 'v3' }`
   * to make `isa.zyins.prequalify` route here.
   */
  public readonly prequalifyV3: PrequalifyV3Callable;
  /**
   * `isa.zyins.quote` — runs the quote decision against the version pinned
   * on the parent `Isa`. Pin via `apiVersion: { quote: 'v3' }` to route to
   * {@link quoteV3}; v1/v2 quote facades are not implemented.
   */
  public readonly quote: QuoteV3Callable;
  /**
   * `isa.zyins.quoteV3` — callable that runs the v3 quote call
   * (`POST /v3/quote`). Returns qualifying products grouped by requested
   * amount with the same uniform `pricing[]` table as v3 prequalify.
   */
  public readonly quoteV3: QuoteV3Callable;
  /**
   * `isa.zyins.products` — live product catalog built from server datasets.
   * `catalog()` fetches once and memoizes; `refresh()` forces a re-fetch.
   */
  public readonly products: ProductsFacade;
  /**
   * `isa.zyins.license` — license lifecycle (activate / check / deactivate).
   *
   * Per the locked-spec surface (post-lock correction #3), this is the
   * canonical singular form. A device has exactly one license.
   */
  public readonly license: LicenseFacade;
  /** `isa.zyins.logos` — carrier-logo asset lookup (public, no auth). */
  public readonly logos: LogosFacade;

  constructor(opts: ZyInsNamespaceOptions) {
    this.opts = opts;
    let cached: ZyInsClient | undefined;
    this.clientOnce = () => {
      if (cached) return cached;
      cached = buildZyInsClient(opts);
      return cached;
    };
    this.branding = new BrandingFacade(this.clientOnce);
    // Shared bundle cache: DatasetsFacade.getV3() writes the freshest
    // bundle here and the ReferenceFacade reads from it lazily, so
    // `isa.zyins.reference.medications.match()` works without any
    // consumer-side plumbing once `datasets.getV3()` has been awaited.
    const referenceBundleCache = new ReferenceBundleCache();
    this.referenceBundleCache = referenceBundleCache;
    this.datasets = new DatasetsFacade(this.clientOnce, (bundle) => referenceBundleCache.setBundle(bundle));
    // An explicit source warms the reference index from a local artifact;
    // its absence leaves the API path (`datasets.get()`) as the only
    // warmer — the unchanged default. The ApiDatasetSource below is only
    // the fallback wired into a ResolvingDatasetSource by the caller; the
    // namespace never auto-fetches it.
    this.datasetSource = opts.datasetSource;
    this.reference = new ReferenceFacade(referenceBundleCache, {
      ...(opts.autocorrector !== undefined && { autocorrector: opts.autocorrector }),
      ...(opts.matchAlgorithm !== undefined && { matchAlgorithm: opts.matchAlgorithm }),
      ...(opts.autocompleteAlgorithm !== undefined && {
        autocompleteAlgorithm: opts.autocompleteAlgorithm,
      }),
    });
    this.medications = this.reference.medications;
    this.conditions = this.reference.conditions;
    this.autocorrector = this.reference.autocorrector;
    this.matcher = this.reference.matcher;
    this.preferences = new PreferencesFacade(this.clientOnce);
    let cachedStorage: CaseStorage | undefined;
    const caseStorageOnce = (): CaseStorage => {
      if (cachedStorage) return cachedStorage;
      if (opts.caseStorageOverride) {
        cachedStorage = opts.caseStorageOverride;
      } else {
        cachedStorage = new ZeroKnowledgeCaseStorage(() => this.clientOnce().cases.context);
      }
      return cachedStorage;
    };
    const caseViewerBaseUrlOnce = (): string => opts.caseViewerBaseUrl ?? DEFAULT_CASE_VIEWER_BASE_URL;
    this.cases = new CasesFacade(this.clientOnce, caseStorageOnce, caseViewerBaseUrlOnce);
    this.email = new EmailFacade(this.clientOnce);
    this.prequalifyV1 = buildPrequalifyV1Callable(this.clientOnce, opts.apiVersion.prequalify);
    this.prequalifyV2 = buildPrequalifyV2Callable(this.clientOnce, opts.apiVersion.prequalify);
    this.prequalifyV3 = buildPrequalifyV3Callable(this.clientOnce, opts.apiVersion.prequalify);
    this.quoteV3 = buildQuoteV3Callable(this.clientOnce, opts.apiVersion.quote);
    // Route `quote` by the pinned quote version, mirroring `prequalify`.
    // Only the v3 quote surface is implemented, so a v3 pin reuses the
    // `quoteV3` instance (reference-identical) and any other pin gets a
    // callable that rejects with a `quote`-named config error — never the
    // internal `quoteV3` alias the consumer did not type.
    this.quote = opts.apiVersion.quote === "v3"
      ? this.quoteV3
      : buildQuoteUnsupportedCallable(opts.apiVersion.quote);
    // The de-versioned `prequalify` is typed as the bundled-default v3
    // surface (`PrequalifyV3Callable`) so documented examples reach
    // `pricing[]` / `deathBenefit` without narrowing. A v1/v2 pin re-routes
    // the runtime call; that path's wire shape is reached through the
    // explicit `prequalifyV1` / `prequalifyV2` callables, so the cast is the
    // single point where the static v3 type and the runtime routing meet.
    this.prequalify = opts.apiVersion.prequalify === "v1"
      ? (this.prequalifyV1 as unknown as PrequalifyV3Callable)
      : opts.apiVersion.prequalify === "v3"
      ? this.prequalifyV3
      : (this.prequalifyV2 as unknown as PrequalifyV3Callable);
    this.products = new ProductsFacade(this.datasets);
    this.license = buildLicenseFacade(opts);
    this.logos = new LogosFacade(
      opts.baseUrl ?? DEFAULT_ZYINS_BASE_URL,
      opts.logosFetch,
    );
  }

  /**
   * Load the reference bundle from the configured {@link DatasetSource} and
   * warm the reference index — `conditions.match()` / `medications.match()`
   * then resolve with no network. A no-op when no source is configured (the
   * unchanged API-fetch default). Called once by the factory before the
   * `Isa` instance is handed back so the first synchronous `match()` sees a
   * primed catalog.
   */
  async warmReferenceBundle(): Promise<void> {
    if (this.datasetSource === undefined) return;
    const bundle = await this.datasetSource.load();
    this.referenceBundleCache.setBundle(bundle);
  }

  /**
   * An {@link ApiDatasetSource} bound to this namespace's configured
   * credential — the current `datasets.get()` HTTP path. Exposed so a
   * caller can place it last in a {@link ResolvingDatasetSource} chain
   * (local file → generate hook → this) without minting a second client.
   */
  apiDatasetSource(): ApiDatasetSource {
    return new ApiDatasetSource(() => this.datasets.get());
  }

  /**
   * Raw-response sibling of {@link prequalify}; follows the pinned API
   * version at runtime but is typed against the bundled-default v3 shape
   * (`PrequalifyV3Request` → `RawResponseResult<PrequalifyV3Result>`) so the
   * de-versioned `data` exposes `plans[].pricing` / `deathBenefit` without
   * narrowing. v1/v2-pinned callers reach the legacy shape through
   * {@link prequalifyV2Raw}.
   */
  prequalifyRaw = async (
    request: PrequalifyV3Request,
  ): Promise<RawResponseResult<PrequalifyV3Result>> => {
    const client = this.clientOnce();
    const pinned = this.opts.apiVersion.prequalify;
    if (pinned === "v1") {
      const result = await client.prequalify(request as unknown as PrequalifyRequest);
      return {
        data: result as unknown as PrequalifyV3Result,
        response: synthesizeRawResponse(result.requestId),
      };
    }
    if (pinned === "v2") {
      const result = await client.prequalifyV2(request as unknown as PrequalifyV2Request);
      return {
        data: result as unknown as PrequalifyV3Result,
        response: synthesizeRawResponse(result.requestId),
      };
    }
    const result = await client.prequalifyV3(request);
    return { data: result, response: synthesizeRawResponse(result.requestId) };
  };

  /** Raw-response sibling of `prequalifyV2`. */
  prequalifyV2Raw = async (
    request: PrequalifyV2Request,
  ): Promise<RawResponseResult<PrequalifyV2Result>> => {
    assertPrequalifyApiVersion(this.opts.apiVersion.prequalify, "v2", "prequalifyV2Raw");
    const client = this.clientOnce();
    const result = await client.prequalifyV2(request);
    return { data: result, response: synthesizeRawResponse(result.requestId) };
  };

  /** Raw-response sibling of `prequalifyV3`. */
  prequalifyV3Raw = async (
    request: PrequalifyV3Request,
  ): Promise<RawResponseResult<PrequalifyV3Result>> => {
    assertPrequalifyApiVersion(this.opts.apiVersion.prequalify, "v3", "prequalifyV3Raw");
    const client = this.clientOnce();
    const result = await client.prequalifyV3(request);
    return { data: result, response: synthesizeRawResponse(result.requestId) };
  };

  /** Raw-response sibling of `quoteV3`. */
  quoteV3Raw = async (
    request: QuoteV3Request,
  ): Promise<RawResponseResult<QuoteV3Result>> => {
    assertQuoteApiVersion(this.opts.apiVersion.quote, "v3", "quoteV3Raw");
    const client = this.clientOnce();
    const result = await client.quoteV3(request);
    return { data: result, response: synthesizeRawResponse(result.requestId) };
  };
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

/** Build the v1 prequalify callable backed by the lazily-constructed client. */
function buildPrequalifyV1Callable(
  clientOnce: () => ZyInsClient,
  apiVersion: IsaApiVersion,
): PrequalifyV1Callable {
  return async (request: PrequalifyRequest): Promise<Envelope<PrequalifyResult>> => {
    assertPrequalifyApiVersion(apiVersion, "v1", "prequalifyV1");
    const client = clientOnce();
    const result = await client.prequalify(request);
    return wrapEnvelope(
      result,
      result.requestId,
      result.idempotencyKey,
      result.livemode,
      result.retryAttempts,
    );
  };
}

/**
 * Shape of `isa.zyins.prequalifyV2` — a callable for the typed v2
 * prequalify call. Returns `Envelope<PrequalifyV2Result>`.
 */
export interface PrequalifyV2Callable {
  (request: PrequalifyV2Request): Promise<Envelope<PrequalifyV2Result>>;
}

/** Build the `prequalifyV2` callable backed by the lazily-constructed client. */
function buildPrequalifyV2Callable(
  clientOnce: () => ZyInsClient,
  apiVersion: IsaApiVersion,
): PrequalifyV2Callable {
  return async (request: PrequalifyV2Request): Promise<Envelope<PrequalifyV2Result>> => {
    assertPrequalifyApiVersion(apiVersion, "v2", "prequalifyV2");
    const client = clientOnce();
    const result = await client.prequalifyV2(request);
    return wrapEnvelope(
      result,
      result.requestId,
      result.idempotencyKey,
      result.livemode,
      result.retryAttempts,
    );
  };
}

function assertPrequalifyApiVersion(
  actual: IsaApiVersion,
  expected: IsaApiVersion,
  methodName: string,
): void {
  if (actual === expected) return;
  throw new IsaConfigError(
    `isa.zyins.${methodName} requires apiVersion '${expected}', but this Isa instance is pinned to '${actual}'`,
  );
}

/**
 * Shape of `isa.zyins.prequalifyV3` — a callable for the typed v3
 * prequalify call. Returns `Envelope<PrequalifyV3Result>`.
 */
export interface PrequalifyV3Callable {
  (request: PrequalifyV3Request): Promise<Envelope<PrequalifyV3Result>>;
}

/** Build the `prequalifyV3` callable backed by the lazily-constructed client. */
function buildPrequalifyV3Callable(
  clientOnce: () => ZyInsClient,
  apiVersion: IsaApiVersion,
): PrequalifyV3Callable {
  return async (request: PrequalifyV3Request): Promise<Envelope<PrequalifyV3Result>> => {
    assertPrequalifyApiVersion(apiVersion, "v3", "prequalifyV3");
    const client = clientOnce();
    const result = await client.prequalifyV3(request);
    return wrapEnvelope(
      result,
      result.requestId,
      result.idempotencyKey,
      result.livemode,
      result.retryAttempts,
    );
  };
}

/**
 * Shape of `isa.zyins.quoteV3` — a callable for the typed v3 quote call.
 * Returns `Envelope<QuoteV3Result>`.
 */
export interface QuoteV3Callable {
  (request: QuoteV3Request): Promise<Envelope<QuoteV3Result>>;
}

/** Build the `quoteV3` callable backed by the lazily-constructed client. */
function buildQuoteV3Callable(
  clientOnce: () => ZyInsClient,
  apiVersion: IsaApiVersion,
): QuoteV3Callable {
  return async (request: QuoteV3Request): Promise<Envelope<QuoteV3Result>> => {
    assertQuoteApiVersion(apiVersion, "v3", "quoteV3");
    const client = clientOnce();
    const result = await client.quoteV3(request);
    return wrapEnvelope(
      result,
      result.requestId,
      result.idempotencyKey,
      result.livemode,
      result.retryAttempts,
    );
  };
}

/**
 * Build the `isa.zyins.quote` callable for an instance NOT pinned to v3.
 * Quote ships only a v3 surface, so the callable rejects with a
 * `quote`-named {@link IsaConfigError} at call time. The error names the
 * caller-facing `quote` method, never the internal `quoteV3` alias.
 */
function buildQuoteUnsupportedCallable(apiVersion: IsaApiVersion): QuoteV3Callable {
  return (_request: QuoteV3Request): Promise<Envelope<QuoteV3Result>> =>
    Promise.reject(quoteVersionError(apiVersion, "v3", "quote"));
}

/**
 * Construct the {@link IsaConfigError} thrown when a quote callable is
 * invoked on an instance not pinned to the required version. `expected`
 * is the version the surface requires; `methodName` is the caller-facing
 * accessor (`quote` / `quoteV3`) so the message never leaks an internal
 * alias the consumer did not type.
 */
function quoteVersionError(
  actual: IsaApiVersion,
  expected: IsaApiVersion,
  methodName: string,
): IsaConfigError {
  return new IsaConfigError(
    `isa.zyins.${methodName} requires apiVersion '${expected}' on the quote surface, but this Isa instance is pinned to '${actual}'`,
  );
}

function assertQuoteApiVersion(
  actual: IsaApiVersion,
  expected: IsaApiVersion,
  methodName: string,
): void {
  if (actual === expected) return;
  throw quoteVersionError(actual, expected, methodName);
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
export function wrapEnvelope<T>(
  data: T,
  requestId: string,
  idempotencyKey = "",
  livemode = true,
  retryAttempts = 0,
): Envelope<T> {
  return {
    data,
    requestId,
    idempotencyKey,
    livemode,
    retryAttempts,
    _requestId: requestId,
    _idempotencyKey: idempotencyKey,
  };
}

/**
 * Build a synthetic `RawResponse` for product calls whose underlying
 * transport does not yet surface status/headers/url. The synthetic value
 * carries the request id so call sites can correlate to logs even when the
 * full HTTP envelope is not visible.
 */
function synthesizeRawResponse(requestId: string): RawResponse {
  return {
    status: 200,
    headers: { "x-isa-request-id": requestId },
    url: "",
  };
}

/**
 * Build the underlying `ZyInsClient` for the namespace's auth identity.
 *
 * License mode signs each v3 request with a transparently-bootstrapped
 * session (see {@link sessionSigner}), never the raw license key; bearer
 * mode attaches `Authorization: Bearer <token>` (API-licensing customers
 * reaching `/v3` server-to-server); session mode signs with the supplied
 * session as-is (an embedded app's redeemed launch session).
 */
function buildZyInsClient(opts: ZyInsNamespaceOptions): ZyInsClient {
  switch (opts.identity.mode) {
    case "license":
      return buildLicenseClient(opts);
    case "bearer":
      return buildBearerClient(opts, opts.identity.token);
    case "session":
      return buildSignerClient(opts, sessionCredentialSigner(opts.identity));
  }
}

/**
 * Build the `ZyInsClient` for the keycode / BPP-agent path.
 *
 * The credential a caller supplies (`Isa.withKeycode`) is the license
 * identity; the credential that actually travels on the wire is a
 * short-lived session, transparently bootstrapped and renewed by
 * {@link sessionSigner}. Callers never see this — they still call
 * `isa.zyins.*` exactly as before. Only v3 product surfaces
 * (prequalify-v3, quote-v3, datasets-v3) read `ctx.signer`; older
 * surfaces (branding, preferences, cases, v1/v2 endpoints) still build
 * their own `Authorization: License base64(...)` header directly and are
 * unaffected by this change — see the SDK's tracked follow-up.
 */
function buildLicenseClient(opts: ZyInsNamespaceOptions): ZyInsClient {
  if (!opts.credentialState) {
    throw new IsaConfigError(
      "isa.zyins.* product methods require a credential state (constructed by Isa.withKeycode)",
    );
  }
  if (opts.identity.mode !== "license") {
    throw new IsaConfigError(
      "isa.zyins.* product methods require Isa.withKeycode() — got a non-license identity",
    );
  }
  const clientOpts: ZyInsClientOptions = {
    auth: opts.credentialState.auth,
    baseUrl: opts.baseUrl ?? DEFAULT_ZYINS_BASE_URL,
  };
  if (opts.caseViewerBaseUrl !== undefined) clientOpts.caseViewerBaseUrl = opts.caseViewerBaseUrl;
  const baseTransport = guardTransportWithLicenseKey(
    opts.logger
      ? wrapTransportWithLogger(opts.transport ?? defaultTransport(), opts.logger)
      : (opts.transport ?? defaultTransport()),
    opts.credentialState,
  );
  clientOpts.transport = baseTransport;
  clientOpts.signer = sessionSigner({
    keycode: opts.identity.keycode,
    auth: opts.credentialState.auth,
    transport: baseTransport,
    ...(opts.accountBaseUrl !== undefined && { accountBaseUrl: opts.accountBaseUrl }),
  });
  if (opts.logosFetch) {
    clientOpts.logosFetch = opts.logosFetch;
  }
  return new ZyInsClient(clientOpts);
}

/**
 * Build the bearer-mode `ZyInsClient`: the token is the credential and the
 * server resolves scope and test/live mode from it.
 */
function buildBearerClient(opts: ZyInsNamespaceOptions, token: string): ZyInsClient {
  return buildSignerClient(opts, bearerSigner(token));
}

/**
 * Build a `ZyInsClient` whose signer supplies every v3 request's auth
 * headers, so the `auth` field is an unused placeholder — bearer and session
 * callers carry no License-HMAC identity. Unlike the license path there is no
 * activation gate: the signer's credential is all the server needs.
 */
function buildSignerClient(opts: ZyInsNamespaceOptions, signer: RequestSigner): ZyInsClient {
  const clientOpts: ZyInsClientOptions = {
    auth: SIGNER_OWNED_PLACEHOLDER_AUTH,
    baseUrl: opts.baseUrl ?? DEFAULT_ZYINS_BASE_URL,
    signer,
  };
  if (opts.caseViewerBaseUrl !== undefined) clientOpts.caseViewerBaseUrl = opts.caseViewerBaseUrl;
  clientOpts.transport = opts.logger
    ? wrapTransportWithLogger(opts.transport ?? defaultTransport(), opts.logger)
    : (opts.transport ?? defaultTransport());
  if (opts.logosFetch) {
    clientOpts.logosFetch = opts.logosFetch;
  }
  return new ZyInsClient(clientOpts);
}

/**
 * Placeholder {@link AuthContext} for bearer- and session-mode clients. Their
 * signer overrides auth-header production for every v3 operation, so these
 * fields are never read; they exist only to satisfy the `ZyInsClient`
 * constructor shape. The empty strings would be rejected by `isAuthContext` —
 * by design, since no License-HMAC request is ever signed in these modes.
 */
const SIGNER_OWNED_PLACEHOLDER_AUTH: AuthContext = {
  licenseKey: "",
  orderId: "",
  email: "",
  deviceId: "",
};

function guardTransportWithLicenseKey(inner: Transport, state: IsaCredentialState): Transport {
  return async (request) => {
    if (!state.auth.licenseKey.trim()) {
      throw new IsaNotActivatedError("requires_activation");
    }
    return inner(request);
  };
}

function buildLicenseTransport(opts: ZyInsNamespaceOptions): Transport {
  const baseTransport = opts.transport ?? defaultTransport();
  return opts.logger
    ? wrapTransportWithLogger(baseTransport, opts.logger)
    : baseTransport;
}

/**
 * Build the `license` facade. License-mode instances get a state-backed
 * facade; other modes get a stub that raises `IsaConfigError` on first use.
 */
function buildLicenseFacade(opts: ZyInsNamespaceOptions): LicenseFacade {
  if (opts.identity.mode !== "license" || !opts.credentialState) {
    return licenseNotConfigured();
  }
  return new LicenseFacade({
    state: opts.credentialState,
    baseUrl: opts.baseUrl ?? DEFAULT_ZYINS_BASE_URL,
    transport: buildLicenseTransport(opts),
  });
}

/** Throws on every method when the parent `Isa` is not license-mode. */
function licenseNotConfigured(): LicenseFacade {
  const fail = (): never => {
    throw new IsaConfigError(
      "isa.zyins.license requires Isa.withKeycode({ keycode, email, ... })",
    );
  };
  return new Proxy(Object.create(LicenseFacade.prototype) as LicenseFacade, {
    get: () => fail,
  });
}

/**
 * Construct the {@link IsaCredentialState} for license-mode instances.
 * Returns `undefined` for bearer / session identities; those modes do not
 * use the license HMAC auth path yet.
 */
function buildCredentialStateIfLicense(opts: IsaOptions): IsaCredentialState | undefined {
  if (opts.identity.mode !== "license") return undefined;
  // `Isa.withKeycode` is the only path that constructs a license-mode Isa
  // (constructor is private). That factory always populates `deviceId` +
  // `credentialStore` via `loadOrMintDeviceId`, so both fields are present
  // by contract here.
  if (!opts.deviceId || !opts.credentialStore) {
    throw new IsaConfigError(
      "internal: license-mode Isa constructed without deviceId/credentialStore — use Isa.withKeycode()",
    );
  }
  return new IsaCredentialState(
    {
      keycode: licenseKeyFor(opts.identity),
      email: opts.identity.email,
      deviceId: opts.deviceId,
      licenseKey: opts.licenseKey ?? "",
      orderId: opts.orderId ?? licenseKeyFor(opts.identity),
    },
    opts.credentialStore,
  );
}

/**
 * Wrap a transport with debug logging. The wrapper records the request
 * before delegating, then records the response (or re-raises). Body kind is
 * heuristically detected so legacy form-encoded license bodies redact PII
 * the same way JSON does.
 */
function wrapTransportWithLogger(inner: Transport, logger: DebugLogger): Transport {
  return async (request) => {
    const bodyKind = detectBodyKind(request.body);
    logger.request({
      method: request.method,
      url: request.url,
      headers: request.headers,
      body: request.body,
      bodyKind,
    });
    const response = await inner(request);
    logger.response({
      method: request.method,
      url: request.url,
      status: response.status,
      headers: response.headers,
      body: response.body,
      bodyKind: "unknown",
    });
    return response;
  };
}

function detectBodyKind(body: string): "json" | "form" | "unknown" {
  if (body.startsWith("{") || body.startsWith("[")) return "json";
  if (body.includes("=")) return "form";
  return "unknown";
}

/**
 * The legacy AuthContext distinguishes "licenseKey" (the secret) from
 * "keycode" (the activation token). In modern license-mode the keycode IS
 * the licenseKey from the wire's perspective; this helper makes that
 * mapping explicit so callers don't pass the wrong field.
 */
function licenseKeyFor(identity: LicenseIdentity): string {
  return identity.keycode;
}

/**
 * `isa.rapidsign.*` — RapidSign product namespace.
 *
 * Server surface tracking issue #38; today the namespace exposes a typed
 * verifier (delegated to {@link WebhooksService}) and reserves the room
 * for `documents`. Construction is auth-agnostic — RapidSign credentials
 * are scoped per envelope, not per `Isa`.
 */
export class RapidSignNamespace {
  /**
   * Webhook verifier. `Isa` injects its own `isa.webhooks` instance here
   * (see the constructor call site) so the two stay the same object for
   * spec-alignment; constructed standalone (`new RapidSignNamespace()`),
   * this defaults to a fresh, independent `WebhooksService`.
   */
  readonly webhooks: WebhooksService;

  constructor(webhooks: WebhooksService = new WebhooksService()) {
    this.webhooks = webhooks;
  }
}

/** Default origin for the platform proxy `/v1/call` endpoint. */
export const DEFAULT_PROXY_ORIGIN = "https://proxy.isaapi.com";

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
export class ProxyNamespace {
  private readonly opts: ProxyNamespaceOptions;

  constructor(opts: ProxyNamespaceOptions) {
    this.opts = opts;
  }

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
  async call(opts: ProxyCallOptions): Promise<ProxyCallResult> {
    const identity = this.opts.identity;
    assertSessionIdentityForProxyCall(identity);
    return runProxyCall(
      { proxyOrigin: this.opts.proxyOrigin, identity },
      opts,
    );
  }
}

/**
 * Dispatch a resolved {@link ResolvedIsaOptions} into the matching legacy
 * factory. Keeps `Isa.create` declarative — every leg threads identical
 * `engine` / `apiVersion` / `clientVersion` settings into the underlying
 * `IsaFactoryOptions` and `IsaOptions` shapes.
 */
async function constructFromCreateOptions(
  resolved: ResolvedIsaOptions,
): Promise<Isa> {
  const factoryOptions: IsaFactoryOptions = {
    baseUrl: resolved.baseUrl,
    caseViewerBaseUrl: resolved.caseViewerBaseUrl,
    apiVersion: resolved.apiVersions,
    timeout: resolved.timeoutMs,
  };
  if (resolved.caseStorage !== undefined) {
    factoryOptions.caseStorage = resolved.caseStorage;
  }
  if (resolved.proxyOrigin !== undefined) {
    factoryOptions.proxyOrigin = resolved.proxyOrigin;
  }
  if (resolved.transport !== undefined) {
    factoryOptions.transport = resolved.transport;
  }
  if (resolved.clientVersion !== undefined) {
    factoryOptions.clientVersion = resolved.clientVersion;
  }
  return dispatchAuthSupplier(resolved.auth, factoryOptions);
}

async function dispatchAuthSupplier(
  auth: IsaAuthSupplier,
  factoryOptions: IsaFactoryOptions,
): Promise<Isa> {
  switch (auth.kind) {
    case "bearer": {
      const args = auth.token !== undefined ? { token: auth.token } : undefined;
      return Isa.withBearer(args, processEnv, factoryOptions);
    }
    case "license": {
      // `deviceId` is SDK-internal — derived from the credential store, never
      // passed through. See docs/sdk-syntax-proposal.md §2.8.
      const args: Parameters<typeof Isa.withKeycode>[0] = {};
      if (auth.keycode !== undefined) args.keycode = auth.keycode;
      if (auth.email !== undefined) args.email = auth.email;
      if (auth.orderId !== undefined) args.orderId = auth.orderId;
      if (auth.licenseKey !== undefined) args.licenseKey = auth.licenseKey;
      if (auth.credentialStore !== undefined) args.credentialStore = auth.credentialStore;
      if (auth.onLicenseRefreshed !== undefined) args.onLicenseRefreshed = auth.onLicenseRefreshed;
      return Isa.withKeycode(args, processEnv, factoryOptions);
    }
    case "form":
      return Isa.forForm({ formToken: auth.formToken }, factoryOptions);
    case "session":
      return Isa.withSession(
        { sessionId: auth.sessionId, sessionSecret: auth.sessionSecret },
        processEnv,
        factoryOptions,
      );
  }
}

/**
 * Pin every outbound product call to the parent `Isa`'s API version.
 * The header is additive; consumer-supplied transports cannot accidentally
 * override it because the wrapper writes after the inner build.
 */
const API_VERSION_HEADER = "Api-Version";
const IDEMPOTENCY_KEY_HEADER = "Idempotency-Key";

function wrapTransportPinApiVersion(
  inner: Transport,
  apiVersions: Readonly<Record<IsaApiSurface, IsaApiVersion>>,
): Transport {
  return async (request) => {
    const headers = withoutHeader(request.headers, API_VERSION_HEADER);
    const surface = surfaceForRequestUrl(request.url);
    if (surface !== undefined) {
      headers[API_VERSION_HEADER] = apiVersions[surface];
    }
    return inner({ ...request, headers });
  };
}

/**
 * Extract the surface (if any) the request targets. Surface-less paths
 * (`/v1/logos`, `/v1/email/enqueue`, `/v1/licenses/*`) skip the per-call
 * header pin; the path itself already encodes the major version.
 */
function surfaceForRequestUrl(url: string): IsaApiSurface | undefined {
  try {
    return surfaceForPath(new URL(url).pathname);
  } catch {
    // Relative URL or transport-injected stub — fall back to a substring
    // probe so the wrapper degrades gracefully in test harnesses.
    return surfaceForPath(url);
  }
}

function wrapTransportTimeout(inner: Transport, timeoutMs: number): Transport {
  return async (request) => {
    const controller = new AbortController();
    const { signal, cleanup } = composeAbortSignals(request.signal, controller.signal);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new IsaTimeoutError(`Transport request timed out after ${timeoutMs}ms`));
        controller.abort();
      }, timeoutMs);
    });
    try {
      return await Promise.race([inner({ ...request, signal }), timeout]);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      cleanup();
    }
  };
}

function composeAbortSignals(
  callerSignal: AbortSignal | undefined,
  timeoutSignal: AbortSignal,
): { signal: AbortSignal; cleanup: () => void } {
  if (!callerSignal) return { signal: timeoutSignal, cleanup: () => undefined };
  const controller = new AbortController();
  const abort = (): void => controller.abort();
  if (callerSignal.aborted || timeoutSignal.aborted) {
    abort();
    return { signal: controller.signal, cleanup: () => undefined };
  }
  callerSignal.addEventListener("abort", abort, { once: true });
  timeoutSignal.addEventListener("abort", abort, { once: true });
  return {
    signal: controller.signal,
    cleanup: () => {
      callerSignal.removeEventListener("abort", abort);
      timeoutSignal.removeEventListener("abort", abort);
    },
  };
}

/** Maximum number of `409 idempotency_conflict` retries per call. */
const IDEMPOTENCY_CONFLICT_MAX_RETRIES = 1;

/**
 * Self-heal a single `409 idempotency_conflict` by re-issuing the request
 * with a freshly-minted UUID v4 idempotency key. Mirrors the bpp2.0 shim
 * absorbed into the SDK by this PR. The conflict typically arises when
 * the deterministic key derivation collides inside the server's 24h
 * replay window — the body is unchanged byte-for-byte, only the
 * `Idempotency-Key` header rotates, so the license HMAC remains valid.
 */
function wrapTransportIdempotencyRetry(inner: Transport): Transport {
  return async (request) => {
    const response = await inner(request);
    if (response.status !== 409) return withRetryAttempts(response, 0);
    if (!isIdempotencyConflictBody(response.body)) return withRetryAttempts(response, 0);
    let lastResponse = response;
    let attempts = 0;
    for (let attempt = 0; attempt < IDEMPOTENCY_CONFLICT_MAX_RETRIES; attempt++) {
      const swapped = swapIdempotencyKey(request.headers);
      attempts += 1;
      lastResponse = await inner({ ...request, headers: swapped });
      if (lastResponse.status !== 409 || !isIdempotencyConflictBody(lastResponse.body)) {
        break;
      }
    }
    return withRetryAttempts(lastResponse, attempts);
  };
}

function withRetryAttempts(response: Awaited<ReturnType<Transport>>, attempts: number) {
  return {
    ...response,
    headers: { ...response.headers, [SDK_RETRY_ATTEMPTS_HEADER]: String(attempts) },
  };
}

function isIdempotencyConflictBody(body: string): boolean {
  if (!body) return false;
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return false;
  }
  if (typeof parsed !== "object" || parsed === null) return false;
  const root = parsed as { code?: unknown; error?: unknown };
  if (root.code === "idempotency_conflict") return true;
  if (typeof root.error === "object" && root.error !== null) {
    const errCode = (root.error as { code?: unknown }).code;
    if (errCode === "idempotency_conflict") return true;
  }
  return false;
}

function swapIdempotencyKey(headers: Record<string, string>): Record<string, string> {
  const out = withoutHeader(headers, IDEMPOTENCY_KEY_HEADER);
  out[IDEMPOTENCY_KEY_HEADER] = mintFreshIdempotencyKey();
  return out;
}

function withoutHeader(headers: Record<string, string>, headerName: string): Record<string, string> {
  const out: Record<string, string> = {};
  const lowerName = headerName.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== lowerName) out[key] = value;
  }
  return out;
}

function mintFreshIdempotencyKey(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto && typeof g.crypto.randomUUID === "function") {
    return g.crypto.randomUUID();
  }
  // Last-resort fallback. Uniqueness is sufficient because the server
  // only requires that the new key differ from the colliding one.
  const hex = "0123456789abcdef";
  let out = "";
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      out += "-";
      continue;
    }
    if (i === 14) {
      out += "4";
      continue;
    }
    const r = Math.floor(Math.random() * 16);
    if (i === 19) {
      out += hex[(r & 0x3) | 0x8];
      continue;
    }
    out += hex[r];
  }
  return out;
}
