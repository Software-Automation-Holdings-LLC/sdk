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
import { IsaConfigError, IsaNotActivatedError } from './apiError';
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
} from './isaNamespaces';
import { ProductsFacade } from './products';
import { AccountNamespace } from '../account';
import { buildAccountNamespace } from '../account/factory';

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
   * Shared credential state for license-mode `Isa` instances. Mutated in
   * place by `isa.zyins.license.activate()`; `undefined` for bearer /
   * session identities.
   */
  public readonly credentialState: IsaCredentialState | undefined;

  private constructor(opts: IsaOptions) {
    this.identity = opts.identity;
    this.logger =
      opts.logger ??
      debugLoggerFromEnv(opts.env ?? processEnv, opts.logSink ?? stderrSink);
    this.credentialState = buildCredentialStateIfLicense(opts);
    if (this.credentialState && opts.onLicenseRefreshed) {
      this.credentialState.onLicenseRefreshed(opts.onLicenseRefreshed);
    }
    const nsOpts: ZyInsNamespaceOptions = { identity: opts.identity };
    if (opts.baseUrl !== undefined) nsOpts.baseUrl = opts.baseUrl;
    if (this.logger !== undefined) nsOpts.logger = this.logger;
    if (this.credentialState !== undefined) nsOpts.credentialState = this.credentialState;
    if (opts.transport !== undefined) nsOpts.transport = opts.transport;
    if (opts.logosFetch !== undefined) nsOpts.logosFetch = opts.logosFetch;
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
      ...(this.credentialState !== undefined && { credentialState: this.credentialState }),
    });
    this.webhooks = new WebhooksService();
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
      deviceId?: string;
      orderId?: string;
      licenseKey?: string;
      credentialStore?: CredentialStore;
      onLicenseRefreshed?: LicenseRefreshedListener;
      transport?: Transport;
    },
    env: EnvReader = processEnv,
    options: IsaFactoryOptions = {},
  ): Promise<Isa> {
    const identity = resolveLicenseIdentity(args, env);
    // Resolve credentials BEFORE construction so the very first product call
    // sees a complete credential state. Probe the supplied store; fall back
    // to an in-memory store so the device-id mint path still runs (and the
    // freshly minted id persists for the lifetime of the process).
    const store = args?.credentialStore ?? inMemoryCredentialStore();
    const deviceId = args?.deviceId ?? (await loadOrMintDeviceId(store));
    const licenseKey =
      args?.licenseKey ?? (await store.get(CREDENTIAL_KEYS.licenseKey));

    const opts: IsaOptions = { identity, ...options };
    opts.deviceId = deviceId;
    if (args?.orderId !== undefined) opts.orderId = args.orderId;
    if (licenseKey !== undefined) opts.licenseKey = licenseKey;
    opts.credentialStore = store;
    if (args?.onLicenseRefreshed !== undefined) opts.onLicenseRefreshed = args.onLicenseRefreshed;
    if (args?.transport !== undefined) opts.transport = args.transport;
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
    const transport: Transport = options.transport ?? defaultTransport();
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
export class ZyInsNamespace {
  private readonly opts: ZyInsNamespaceOptions;
  private readonly clientOnce: () => ZyInsClient;
  /** `isa.zyins.branding` — whitelabel lookup. */
  public readonly branding: BrandingFacade;
  /** `isa.zyins.datasets` — reference-data bundle for picker UIs. */
  public readonly datasets: DatasetsFacade;
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
   * `isa.zyins.prequalify` — callable that runs the prequalify decision
   * from a typed `PrequalifyRequest`.
   */
  public readonly prequalify: PrequalifyCallable;
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
    this.datasets = new DatasetsFacade(this.clientOnce);
    this.preferences = new PreferencesFacade(this.clientOnce);
    this.cases = new CasesFacade(this.clientOnce);
    this.email = new EmailFacade(this.clientOnce);
    this.prequalify = buildPrequalifyCallable(this.clientOnce);
    this.products = new ProductsFacade(this.datasets);
    this.license = buildLicenseFacade(opts);
    this.logos = new LogosFacade(
      opts.baseUrl ?? DEFAULT_ZYINS_BASE_URL,
      opts.logosFetch,
    );
  }

  /** Raw-response sibling of `prequalify`. */
  prequalifyRaw = async (
    request: PrequalifyRequest,
  ): Promise<RawResponseResult<PrequalifyResult>> => {
    const client = this.clientOnce();
    const result = await client.prequalify(request);
    return { data: result, response: synthesizeRawResponse(result.requestId) };
  };
}

/**
 * Shape of `isa.zyins.prequalify` — a callable for the typed prequalify
 * call. Returns `Envelope<PrequalifyResult>`.
 */
export interface PrequalifyCallable {
  (request: PrequalifyRequest): Promise<Envelope<PrequalifyResult>>;
}

/** Build the `prequalify` callable backed by the lazily-constructed client. */
function buildPrequalifyCallable(clientOnce: () => ZyInsClient): PrequalifyCallable {
  return async (request: PrequalifyRequest): Promise<Envelope<PrequalifyResult>> => {
    const client = clientOnce();
    const result = await client.prequalify(request);
    return wrapEnvelope(result, result.requestId, result.idempotencyKey);
  };
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
): Envelope<T> {
  return {
    data,
    requestId,
    idempotencyKey,
    livemode: true,
    retryAttempts: 0,
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
