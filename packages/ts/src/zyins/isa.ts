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

import {
  type IsaIdentity,
  type LicenseIdentity,
  resolveBearerIdentity,
  resolveLicenseIdentity,
  resolveSessionIdentity,
  ENV_VAR_NAMES,
} from './envFactory';
import { IsaConfigError, IsaNotActivatedError, IsaTimeoutError } from './apiError';
import {
  type CredentialStore,
  CREDENTIAL_KEYS,
  inMemoryCredentialStore,
  loadOrMintDeviceId,
} from '../core';
import {
  IsaCredentialState,
  type LicenseRefreshedListener,
} from './credentialState';
import {
  type DebugLogger,
  type EnvReader,
  type LogSink,
  debugLoggerFromEnv,
  processEnv,
  stderrSink,
} from './logger';
import {
  type Envelope,
  type RawResponse,
  type RawResponseResult,
} from './envelope';
import { type AuthContext } from './auth';
import { ZyInsClient, DEFAULT_ZYINS_BASE_URL, type ZyInsClientOptions } from './client';
import { defaultTransport, type Transport } from './transport';
import { type LogosFetch } from './logos';
import {
  type PrequalifyRequest,
  type PrequalifyResult,
} from './prequalify';
import {
  type PrequalifyV2Request,
  type PrequalifyV2Result,
} from './prequalify-v2';
import {
  type PrequalifyV3Request,
  type PrequalifyV3Result,
  type QuoteV3Request,
  type QuoteV3Result,
} from './prequalify-v3-types';
import { SDK_RETRY_ATTEMPTS_HEADER } from './retryAttempts';
import { WebhooksService } from '../rapidsign/webhooks';
import {
  type ProxyCallOptions,
  type ProxyCallResult,
  assertSessionIdentityForProxyCall,
  proxyCall as runProxyCall,
} from '../proxy/call';
import {
  BrandingFacade,
  DatasetsFacade,
  PreferencesFacade,
  CasesFacade,
  EmailFacade,
  LicenseFacade,
  LogosFacade,
  ReferenceFacade,
  ReferenceMedicationsFacade,
  ReferenceConditionsFacade,
  ReferenceBundleCache,
  DefaultAutocorrector,
  type Autocorrector,
  type MatchAlgorithm,
  type AutocompleteAlgorithm,
  type DefaultAutocorrectorOptions,
} from './isaNamespaces';
import { ProductsFacade } from './products';
import {
  type ClientVersionListener,
  type ClientVersionStatus,
  evaluateClientVersion,
} from './clientVersion';
import { AccountNamespace } from '../account';
import { buildAccountNamespace } from '../account/factory';
import {
  type IsaApiVersion,
  type IsaApiVersionOverride,
  type IsaApiSurface,
  type IsaCreateOptions,
  type IsaAuthSupplier,
  type ResolvedIsaOptions,
  resolveIsaOptions,
  resolveApiVersions,
  DEFAULT_TIMEOUT_MS,
} from './isaOptions';
import { surfaceForPath } from './bundledApiVersions';
import type { CaseStorage } from './cases/CaseStorage';
import { ZeroKnowledgeCaseStorage } from './cases/ZeroKnowledgeCaseStorage';
import { DEFAULT_CASE_VIEWER_BASE_URL } from '../account/cases';

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
    this.logger =
      opts.logger ??
      debugLoggerFromEnv(opts.env ?? processEnv, opts.logSink ?? stderrSink);
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
    this.zyins = new ZyInsNamespace(nsOpts);
    this.rapidsign = new RapidSignNamespace();
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
    this.webhooks = new WebhooksService();
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
        'Isa.onLicenseRefreshed is available only on license-mode instances',
      );
    }
    return this.credentialState.onLicenseRefreshed(listener);
  }

  /**
   * Construct from a bearer token (server-to-server `isa_live_…` tokens).
   * With no arguments, reads `ISA_TOKEN` from the environment. Throws
   * `IsaConfigError` when neither is supplied.
   *
   * Async for surface uniformity across every factory; the body is trivial
   * today but the contract leaves room to probe a credential store in a
   * later phase without an API-shape break.
   */
  static async withBearer(
    args?: { token?: string },
    env: EnvReader = processEnv,
    options: IsaFactoryOptions = {},
  ): Promise<Isa> {
    return new Isa({ identity: resolveBearerIdentity(args, env), ...options });
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
    const licenseKey =
      args?.licenseKey ?? (await store.get(CREDENTIAL_KEYS.licenseKey));

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
    return new Isa(opts);
  }

  /**
   * Construct from a session (id, secret).
   *
   * @internal
   *
   * Sessions are SDK-internal refresh state minted from a keycode or a
   * form-token; external consumers reach this code path via
   * {@link Isa.withKeycode} or {@link Isa.forForm}. The static method
   * remains so internal factories can compose it cleanly, but it is not
   * part of the public surface and is omitted from the package barrel.
   */
  static async withSession(
    args?: { sessionId?: string; sessionSecret?: string },
    env: EnvReader = processEnv,
    options: IsaFactoryOptions = {},
  ): Promise<Isa> {
    return new Isa({ identity: resolveSessionIdentity(args, env), ...options });
  }

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
  static async forForm(
    args: { formToken: string },
    options: IsaFactoryOptions = {},
  ): Promise<Isa> {
    if (!args?.formToken || args.formToken.length === 0) {
      throw new IsaConfigError(
        'Isa.forForm: formToken is required (typically read from form.metadata._isa_form_token)',
      );
    }
    const baseUrl = options.baseUrl ?? DEFAULT_ZYINS_BASE_URL;
    const transport = wrapTransportTimeout(
      options.transport ?? defaultTransport(),
      options.timeout ?? DEFAULT_TIMEOUT_MS,
    );
    const reissueUrl = `${baseUrl.replace(/\/$/, '')}${SESSIONS_REISSUE_PATH}`;
    const response = await transport({
      method: 'POST',
      url: reissueUrl,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `FormToken ${args.formToken}`,
      },
      body: '{}',
    });
    if (response.status < 200 || response.status >= 300) {
      throw new IsaConfigError(
        `Isa.forForm: ${SESSIONS_REISSUE_PATH} returned ${response.status}; expected 2xx`,
      );
    }
    const { sessionId, sessionSecret } = parseReissueResponse(response.body);
    return new Isa({
      identity: { mode: 'session', sessionId, sessionSecret },
      ...options,
    });
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
      'Isa.authenticate: argument did not match any auth mode (expected {keycode, email}, {token}, or {formToken})',
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
}

/**
 * Server-side path for the form-token → session exchange. Anchored as a
 * constant so test stubs and the live transport agree on the URL. The
 * endpoint itself lands per task #98 (`account.sessions` surface); the
 * SDK plumbing is wired ahead of the server so consumers can adopt
 * `Isa.forForm` the day it ships.
 */
export const SESSIONS_REISSUE_PATH = '/v1/sessions/reissue';

/** Tagless union accepted by {@link Isa.authenticate}. */
export type IsaAuthArgs =
  | { keycode: string; email: string; credentialStore?: CredentialStore }
  | { token: string }
  | { formToken: string };

function isKeycodeAuthArgs(
  args: IsaAuthArgs,
): args is { keycode: string; email: string; credentialStore?: CredentialStore } {
  return (
    typeof (args as { keycode?: unknown }).keycode === 'string' &&
    typeof (args as { email?: unknown }).email === 'string'
  );
}

function isBearerAuthArgs(args: IsaAuthArgs): args is { token: string } {
  return typeof (args as { token?: unknown }).token === 'string';
}

function isFormAuthArgs(args: IsaAuthArgs): args is { formToken: string } {
  return typeof (args as { formToken?: unknown }).formToken === 'string';
}

/**
 * Parse a `/v1/sessions/reissue` response body. The server returns a
 * standard SDK envelope with `data: { session_id, session_secret }`; the
 * shape is validated lazily so a server-side change surfaces as a typed
 * SDK error rather than `undefined` propagating into the HMAC signer.
 */
function parseReissueResponse(body: string): {
  sessionId: string;
  sessionSecret: string;
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new IsaConfigError(
      `Isa.forForm: ${SESSIONS_REISSUE_PATH} returned non-JSON body`,
    );
  }
  const data =
    (parsed as { data?: unknown }).data ?? parsed; // tolerate envelope OR bare object
  const sessionId =
    (data as { sessionId?: unknown; session_id?: unknown }).sessionId ??
    (data as { session_id?: unknown }).session_id;
  const sessionSecret =
    (data as { sessionSecret?: unknown; session_secret?: unknown }).sessionSecret ??
    (data as { session_secret?: unknown }).session_secret;
  if (typeof sessionId !== 'string' || typeof sessionSecret !== 'string') {
    throw new IsaConfigError(
      `Isa.forForm: ${SESSIONS_REISSUE_PATH} response missing session_id/session_secret`,
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

const AUTOCORRECTOR_KERNEL: AutocorrectorKernel = {
  create: (opts) => new DefaultAutocorrector(opts),
};

/**
 * `isa.zyins.*` — methods for the ZyINS product. Each method has a
 * `.withRawResponse` sibling returning `{ data, response }`.
 *
 * Bearer and session-mode product calls are reserved for a follow-up phase
 * (transport wiring exists in @isa-sdk/core; the namespace stub raises a
 * clear `IsaConfigError` if invoked before that phase lands).
 */
export class ZyInsNamespace {
  private readonly opts: ZyInsNamespaceOptions;
  private readonly clientOnce: () => ZyInsClient;
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
   * version pinned on the parent `Isa`. With the default
   * (`BundledApiVersions.prequalify`) this aliases {@link prequalifyV2} and
   * returns `Envelope<PrequalifyV2Result>`. With
   * `apiVersion: { prequalify: 'v1' }` it routes to {@link prequalifyV1};
   * with `apiVersion: { prequalify: 'v3' }` it routes to
   * {@link prequalifyV3}. Narrow on `isa.apiVersion.prequalify` to
   * disambiguate the return shape.
   */
  public readonly prequalify:
    | PrequalifyV3Callable
    | PrequalifyV2Callable
    | PrequalifyV1Callable;
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
      cached = buildLicenseClient(opts);
      return cached;
    };
    this.branding = new BrandingFacade(this.clientOnce);
    // Shared bundle cache: DatasetsFacade.getV3() writes the freshest
    // bundle here and the ReferenceFacade reads from it lazily, so
    // `isa.zyins.reference.medications.match()` works without any
    // consumer-side plumbing once `datasets.getV3()` has been awaited.
    const referenceBundleCache = new ReferenceBundleCache();
    this.datasets = new DatasetsFacade(this.clientOnce, (bundle) =>
      referenceBundleCache.setBundle(bundle),
    );
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
    const caseViewerBaseUrlOnce = (): string =>
      opts.caseViewerBaseUrl ?? DEFAULT_CASE_VIEWER_BASE_URL;
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
    this.quote =
      opts.apiVersion.quote === 'v3'
        ? this.quoteV3
        : buildQuoteUnsupportedCallable(opts.apiVersion.quote);
    this.prequalify =
      opts.apiVersion.prequalify === 'v1'
        ? this.prequalifyV1
        : opts.apiVersion.prequalify === 'v3'
          ? this.prequalifyV3
          : this.prequalifyV2;
    this.products = new ProductsFacade(this.datasets);
    this.license = buildLicenseFacade(opts);
    this.logos = new LogosFacade(
      opts.baseUrl ?? DEFAULT_ZYINS_BASE_URL,
      opts.logosFetch,
    );
  }

  /** Raw-response sibling of {@link prequalify}; follows the pinned API version. */
  prequalifyRaw = async (
    request: PrequalifyRequest | PrequalifyV2Request | PrequalifyV3Request,
  ): Promise<
    RawResponseResult<PrequalifyResult | PrequalifyV2Result | PrequalifyV3Result>
  > => {
    const client = this.clientOnce();
    const pinned = this.opts.apiVersion.prequalify;
    if (pinned === 'v3') {
      const result = await client.prequalifyV3(request as PrequalifyV3Request);
      return { data: result, response: synthesizeRawResponse(result.requestId) };
    }
    if (pinned === 'v1') {
      const result = await client.prequalify(request as PrequalifyRequest);
      return { data: result, response: synthesizeRawResponse(result.requestId) };
    }
    const result = await client.prequalifyV2(request as PrequalifyV2Request);
    return { data: result, response: synthesizeRawResponse(result.requestId) };
  };

  /** Raw-response sibling of `prequalifyV2`. */
  prequalifyV2Raw = async (
    request: PrequalifyV2Request,
  ): Promise<RawResponseResult<PrequalifyV2Result>> => {
    assertPrequalifyApiVersion(this.opts.apiVersion.prequalify, 'v2', 'prequalifyV2Raw');
    const client = this.clientOnce();
    const result = await client.prequalifyV2(request);
    return { data: result, response: synthesizeRawResponse(result.requestId) };
  };

  /** Raw-response sibling of `prequalifyV3`. */
  prequalifyV3Raw = async (
    request: PrequalifyV3Request,
  ): Promise<RawResponseResult<PrequalifyV3Result>> => {
    assertPrequalifyApiVersion(this.opts.apiVersion.prequalify, 'v3', 'prequalifyV3Raw');
    const client = this.clientOnce();
    const result = await client.prequalifyV3(request);
    return { data: result, response: synthesizeRawResponse(result.requestId) };
  };

  /** Raw-response sibling of `quoteV3`. */
  quoteV3Raw = async (
    request: QuoteV3Request,
  ): Promise<RawResponseResult<QuoteV3Result>> => {
    assertQuoteApiVersion(this.opts.apiVersion.quote, 'v3', 'quoteV3Raw');
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
    assertPrequalifyApiVersion(apiVersion, 'v1', 'prequalifyV1');
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
    assertPrequalifyApiVersion(apiVersion, 'v2', 'prequalifyV2');
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
    assertPrequalifyApiVersion(apiVersion, 'v3', 'prequalifyV3');
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
    assertQuoteApiVersion(apiVersion, 'v3', 'quoteV3');
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
    Promise.reject(quoteVersionError(apiVersion, 'v3', 'quote'));
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
  idempotencyKey = '',
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
    headers: { 'x-isa-request-id': requestId },
    url: '',
  };
}

/**
 * Build the underlying license-mode `ZyInsClient` from the namespace
 * options. Bearer and session callers reach this path only when they
 * supply enough material to satisfy the legacy ZyInsClient — which today
 * means license identity + deviceId + orderId. Other paths throw
 * `IsaConfigError` with a description of what's missing.
 */
function buildLicenseClient(opts: ZyInsNamespaceOptions): ZyInsClient {
  if (opts.identity.mode !== 'license') {
    throw new IsaConfigError(
      `isa.zyins.* product methods currently require Isa.withKeycode() — bearer and session transport wiring lands in Phase 3 of SDK_DESIGN.md`,
    );
  }
  if (!opts.credentialState) {
    throw new IsaConfigError(
      'isa.zyins.* product methods require a credential state (constructed by Isa.withKeycode)',
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
  if (opts.logosFetch) {
    clientOpts.logosFetch = opts.logosFetch;
  }
  return new ZyInsClient(clientOpts);
}

function guardTransportWithLicenseKey(inner: Transport, state: IsaCredentialState): Transport {
  return async (request) => {
    if (!state.auth.licenseKey.trim()) {
      throw new IsaNotActivatedError('requires_activation');
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
  if (opts.identity.mode !== 'license' || !opts.credentialState) {
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
      'isa.zyins.license requires Isa.withKeycode({ keycode, email, ... })',
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
  if (opts.identity.mode !== 'license') return undefined;
  // `Isa.withKeycode` is the only path that constructs a license-mode Isa
  // (constructor is private). That factory always populates `deviceId` +
  // `credentialStore` via `loadOrMintDeviceId`, so both fields are present
  // by contract here.
  if (!opts.deviceId || !opts.credentialStore) {
    throw new IsaConfigError(
      'internal: license-mode Isa constructed without deviceId/credentialStore — use Isa.withKeycode()',
    );
  }
  return new IsaCredentialState(
    {
      keycode: licenseKeyFor(opts.identity),
      email: opts.identity.email,
      deviceId: opts.deviceId,
      licenseKey: opts.licenseKey ?? '',
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
      bodyKind: 'unknown',
    });
    return response;
  };
}

function detectBodyKind(body: string): 'json' | 'form' | 'unknown' {
  if (body.startsWith('{') || body.startsWith('[')) return 'json';
  if (body.includes('=')) return 'form';
  return 'unknown';
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
  /** Webhook verifier — alias of `isa.webhooks` for spec-alignment. */
  readonly webhooks: WebhooksService = new WebhooksService();
}

/** Default origin for the platform proxy `/v1/call` endpoint. */
export const DEFAULT_PROXY_ORIGIN = 'https://proxy.isaapi.com';

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
    case 'bearer': {
      const args = auth.token !== undefined ? { token: auth.token } : undefined;
      return Isa.withBearer(args, processEnv, factoryOptions);
    }
    case 'license': {
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
    case 'form':
      return Isa.forForm({ formToken: auth.formToken }, factoryOptions);
    case 'session':
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
const API_VERSION_HEADER = 'Api-Version';
const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key';

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
  callerSignal.addEventListener('abort', abort, { once: true });
  timeoutSignal.addEventListener('abort', abort, { once: true });
  return {
    signal: controller.signal,
    cleanup: () => {
      callerSignal.removeEventListener('abort', abort);
      timeoutSignal.removeEventListener('abort', abort);
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
  if (typeof parsed !== 'object' || parsed === null) return false;
  const root = parsed as { code?: unknown; error?: unknown };
  if (root.code === 'idempotency_conflict') return true;
  if (typeof root.error === 'object' && root.error !== null) {
    const errCode = (root.error as { code?: unknown }).code;
    if (errCode === 'idempotency_conflict') return true;
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
  if (g.crypto && typeof g.crypto.randomUUID === 'function') {
    return g.crypto.randomUUID();
  }
  // Last-resort fallback. Uniqueness is sufficient because the server
  // only requires that the new key differ from the colliding one.
  const hex = '0123456789abcdef';
  let out = '';
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      out += '-';
      continue;
    }
    if (i === 14) {
      out += '4';
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

