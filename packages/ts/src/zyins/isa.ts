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

import {
  type IsaIdentity,
  type LicenseIdentity,
  resolveBearerIdentity,
  resolveLicenseIdentity,
  resolveSessionIdentity,
  ENV_VAR_NAMES,
} from './envFactory';
import { IsaConfigError } from './apiError';
import {
  type CredentialStore,
  CREDENTIAL_KEYS,
  inMemoryCredentialStore,
  loadOrMintDeviceId,
  mintDeviceId,
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
  type PrequalifyLegacyBlobRequest,
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
  PreferencesFacade,
  CasesFacade,
  EmailFacade,
  LicensesFacade,
  LogosFacade,
} from './isaNamespaces';
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
   * place by `isa.zyins.licenses.activate()`; `undefined` for bearer /
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
   */
  static withBearer(
    args?: { token?: string },
    env: EnvReader = processEnv,
    options: IsaFactoryOptions = {},
  ): Isa {
    return new Isa({ identity: resolveBearerIdentity(args, env), ...options });
  }

  /**
   * Construct from a license keycode + email (BPP agent tools). With no
   * arguments, reads `ISA_LICENSE_KEYCODE` and `ISA_LICENSE_EMAIL` from the
   * environment.
   *
   * `deviceId` and `orderId` may be supplied to unlock product methods now;
   * in a later phase the SDK will load them from durable storage on first
   * product call.
   */
  static withLicense(
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
  ): Isa {
    const identity = resolveLicenseIdentity(args, env);
    const opts: IsaOptions = { identity, ...options };
    if (args?.deviceId !== undefined) opts.deviceId = args.deviceId;
    if (args?.orderId !== undefined) opts.orderId = args.orderId;
    if (args?.licenseKey !== undefined) opts.licenseKey = args.licenseKey;
    if (args?.credentialStore !== undefined) opts.credentialStore = args.credentialStore;
    if (args?.onLicenseRefreshed !== undefined) opts.onLicenseRefreshed = args.onLicenseRefreshed;
    if (args?.transport !== undefined) opts.transport = args.transport;
    return new Isa(opts);
  }

  /**
   * Async variant of {@link withLicense}. Probes the credential store for a
   * persisted `deviceId` + `licenseKey` BEFORE constructing the instance so
   * the very first call already has every credential it needs. Use this in
   * runtimes with persistent storage (React Native, browsers) to skip the
   * synchronous-mint fallback and reuse the device id across process boots.
   */
  static async withLicenseAsync(
    args: {
      keycode?: string;
      email?: string;
      deviceId?: string;
      orderId?: string;
      licenseKey?: string;
      credentialStore: CredentialStore;
      onLicenseRefreshed?: LicenseRefreshedListener;
      transport?: Transport;
    },
    env: EnvReader = processEnv,
  ): Promise<Isa> {
    const deviceId = args.deviceId ?? (await loadOrMintDeviceId(args.credentialStore));
    const storedKey = await args.credentialStore.get(CREDENTIAL_KEYS.licenseKey);
    const licenseKey = args.licenseKey ?? storedKey;
    const merged = { ...args, deviceId, ...(licenseKey !== undefined && { licenseKey }) };
    return Isa.withLicense(merged, env);
  }

  /**
   * Auto-detect mode from environment variables: bearer if `ISA_TOKEN` is
   * set, license if `ISA_LICENSE_KEYCODE` + `ISA_LICENSE_EMAIL` are set,
   * session if `ISA_SESSION_ID` + `ISA_SESSION_SECRET` are set. Throws
   * `IsaConfigError` when no mode matches.
   */
  static fromEnv(env: EnvReader = processEnv): Isa {
    if (env.get(ENV_VAR_NAMES.bearer.token)) return Isa.withBearer(undefined, env);
    if (env.get(ENV_VAR_NAMES.license.keycode) && env.get(ENV_VAR_NAMES.license.email)) {
      return Isa.withLicense(undefined, env);
    }
    if (env.get(ENV_VAR_NAMES.session.sessionId) && env.get(ENV_VAR_NAMES.session.sessionSecret)) {
      return Isa.withSession(undefined, env);
    }
    throw new IsaConfigError(
      `Isa.fromEnv: no recognized credential in environment (set ${ENV_VAR_NAMES.bearer.token}, ${ENV_VAR_NAMES.license.keycode} + ${ENV_VAR_NAMES.license.email}, or ${ENV_VAR_NAMES.session.sessionId} + ${ENV_VAR_NAMES.session.sessionSecret})`,
    );
  }

  /**
   * Construct from a session (id, secret) — embedded forms. With no
   * arguments, reads `ISA_SESSION_ID` and the session-secret env var from
   * the environment.
   */
  static withSession(
    args?: { sessionId?: string; sessionSecret?: string },
    env: EnvReader = processEnv,
    options: IsaFactoryOptions = {},
  ): Isa {
    return new Isa({ identity: resolveSessionIdentity(args, env), ...options });
  }
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
   * from a typed `PrequalifyRequest`. Carries a `legacyBlob` property for
   * consumers (bpp2.0) whose long-standing encoder produces the wire
   * payload directly and would have to restructure their call site to use
   * the typed shape.
   */
  public readonly prequalify: PrequalifyCallable;
  /** `isa.zyins.licenses` — license lifecycle (activate / check / deactivate). */
  public readonly licenses: LicensesFacade;
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
    this.preferences = new PreferencesFacade(this.clientOnce);
    this.cases = new CasesFacade(this.clientOnce);
    this.email = new EmailFacade(this.clientOnce);
    this.prequalify = buildPrequalifyCallable(this.clientOnce);
    this.licenses = buildLicensesFacade(opts);
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
  legacyBlob(
    request: PrequalifyLegacyBlobRequest,
  ): Promise<Envelope<PrequalifyResult>>;
}

/**
 * Build the `prequalify` callable with the `legacyBlob` property attached.
 * The same `clientOnce` thunk backs both entry points so they share one
 * lazily-constructed client (and therefore one resolved auth context).
 */
function buildPrequalifyCallable(clientOnce: () => ZyInsClient): PrequalifyCallable {
  const callable = (async (
    request: PrequalifyRequest,
  ): Promise<Envelope<PrequalifyResult>> => {
    const client = clientOnce();
    const result = await client.prequalify(request);
    return wrapEnvelope(result, result.requestId);
  }) as PrequalifyCallable;
  callable.legacyBlob = async (
    request: PrequalifyLegacyBlobRequest,
  ): Promise<Envelope<PrequalifyResult>> => {
    const client = clientOnce();
    const result = await client.prequalifyLegacyBlob(request);
    return wrapEnvelope(result, result.requestId);
  };
  return callable;
}

/** Top-level helper to add `.withRawResponse` siblings ergonomically. */
export interface RawCallable<TArgs extends unknown[], TResult> {
  (...args: TArgs): Promise<Envelope<TResult>>;
  withRawResponse(...args: TArgs): Promise<RawResponseResult<TResult>>;
}

/** Wrap a result in an envelope. Defaults for the optional fields are documented in SDK_DESIGN §4.6. */
export function wrapEnvelope<T>(data: T, requestId: string): Envelope<T> {
  return {
    data,
    requestId,
    idempotencyKey: '',
    livemode: true,
    retryAttempts: 0,
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
      `isa.zyins.* product methods currently require Isa.withLicense() — bearer and session transport wiring lands in Phase 3 of SDK_DESIGN.md`,
    );
  }
  if (!opts.credentialState) {
    throw new IsaConfigError(
      'isa.zyins.* product methods require a credential state (constructed by Isa.withLicense)',
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
      throw new IsaConfigError(
        'isa.zyins.* product methods require an active licenseKey; call isa.zyins.licenses.activate() first',
      );
    }
    return inner(request);
  };
}

function buildLicensesTransport(opts: ZyInsNamespaceOptions): Transport {
  const baseTransport = opts.transport ?? defaultTransport();
  return opts.logger
    ? wrapTransportWithLogger(baseTransport, opts.logger)
    : baseTransport;
}

/**
 * Build the licenses facade. License-mode instances get a state-backed
 * facade with optional-arg ergonomics; other modes get a stub that raises
 * `IsaConfigError` until those auth modes are wired.
 */
function buildLicensesFacade(opts: ZyInsNamespaceOptions): LicensesFacade {
  if (opts.identity.mode !== 'license' || !opts.credentialState) {
    return licensesNotConfigured();
  }
  return new LicensesFacade({
    state: opts.credentialState,
    baseUrl: opts.baseUrl ?? DEFAULT_ZYINS_BASE_URL,
    transport: buildLicensesTransport(opts),
  });
}

/** Throws on every method when the parent `Isa` is not license-mode. */
function licensesNotConfigured(): LicensesFacade {
  const fail = (): never => {
    throw new IsaConfigError(
      'isa.zyins.licenses requires Isa.withLicense({ keycode, email, ... })',
    );
  };
  return new Proxy(Object.create(LicensesFacade.prototype) as LicensesFacade, {
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
  const store = opts.credentialStore ?? inMemoryCredentialStore();
  const deviceId = opts.deviceId ?? mintDeviceId();
  if (!opts.deviceId) {
    // Persist the freshly minted id so subsequent calls (and process boots
    // sharing the store) reuse the same value. Best-effort — failures are
    // swallowed because in-memory stores never fail, and a downstream
    // failure on a third-party store must not block construction.
    void store.set(CREDENTIAL_KEYS.deviceId, deviceId).catch(() => {});
  }
  const orderId = opts.orderId ?? licenseKeyFor(opts.identity);
  const licenseKey = opts.licenseKey ?? '';
  return new IsaCredentialState(
    {
      keycode: licenseKeyFor(opts.identity),
      email: opts.identity.email,
      deviceId,
      licenseKey,
      orderId,
    },
    store,
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
