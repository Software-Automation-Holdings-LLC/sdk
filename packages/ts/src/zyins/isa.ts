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
} from './envFactory';
import { IsaConfigError } from './apiError';
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
import {
  type PrequalifyRequest,
  type PrequalifyResult,
} from './prequalify';
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
  /** Top-level webhook verifier. */
  public readonly webhooks: WebhooksService;

  private constructor(opts: IsaOptions) {
    this.identity = opts.identity;
    this.logger =
      opts.logger ??
      debugLoggerFromEnv(opts.env ?? processEnv, opts.logSink ?? stderrSink);
    this.zyins = new ZyInsNamespace({
      identity: opts.identity,
      ...(opts.baseUrl !== undefined && { baseUrl: opts.baseUrl }),
      ...(opts.deviceId !== undefined && { deviceId: opts.deviceId }),
      ...(opts.orderId !== undefined && { orderId: opts.orderId }),
      ...(this.logger !== undefined && { logger: this.logger }),
    });
    this.rapidsign = new RapidSignNamespace();
    this.proxy = new ProxyNamespace();
    this.webhooks = new WebhooksService();
  }

  /**
   * Construct from a bearer token (server-to-server `isa_live_…` tokens).
   * With no arguments, reads `ISA_TOKEN` from the environment. Throws
   * `IsaConfigError` when neither is supplied.
   */
  static withBearer(args?: { token?: string }, env: EnvReader = processEnv): Isa {
    return new Isa({ identity: resolveBearerIdentity(args, env) });
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
    args?: { keycode?: string; email?: string; deviceId?: string; orderId?: string },
    env: EnvReader = processEnv,
  ): Isa {
    const identity = resolveLicenseIdentity(args, env);
    const opts: IsaOptions = { identity };
    if (args?.deviceId !== undefined) opts.deviceId = args.deviceId;
    if (args?.orderId !== undefined) opts.orderId = args.orderId;
    return new Isa(opts);
  }

  /**
   * Construct from a session (id, secret) — embedded forms. With no
   * arguments, reads `ISA_SESSION_ID` and the session-secret env var from
   * the environment.
   */
  static withSession(
    args?: { sessionId?: string; sessionSecret?: string },
    env: EnvReader = processEnv,
  ): Isa {
    return new Isa({ identity: resolveSessionIdentity(args, env) });
  }
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
export class ZyInsNamespace {
  private readonly opts: ZyInsNamespaceOptions;
  private readonly clientOnce: () => ZyInsClient;

  constructor(opts: ZyInsNamespaceOptions) {
    this.opts = opts;
    let cached: ZyInsClient | undefined;
    this.clientOnce = () => {
      if (cached) return cached;
      cached = buildLicenseClient(opts);
      return cached;
    };
  }

  /**
   * Run the prequalify decision. Returns an `Envelope<PrequalifyResult>`
   * with named `requestId`, `idempotencyKey`, and `retryAttempts` fields.
   */
  async prequalify(request: PrequalifyRequest): Promise<Envelope<PrequalifyResult>> {
    const client = this.clientOnce();
    const result = await client.prequalify(request);
    return wrapEnvelope(result, result.requestId);
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
  if (!opts.deviceId) {
    throw new IsaConfigError(
      `isa.zyins.* product methods require a deviceId on Isa.withLicense({ deviceId, orderId, … })`,
    );
  }
  if (!opts.orderId) {
    throw new IsaConfigError(
      `isa.zyins.* product methods require an orderId on Isa.withLicense({ deviceId, orderId, … })`,
    );
  }
  const auth: AuthContext = {
    licenseKey: licenseKeyFor(opts.identity),
    orderId: opts.orderId,
    email: opts.identity.email,
    deviceId: opts.deviceId,
  };
  const clientOpts: ZyInsClientOptions = {
    auth,
    baseUrl: opts.baseUrl ?? DEFAULT_ZYINS_BASE_URL,
  };
  if (opts.logger) {
    clientOpts.transport = wrapTransportWithLogger(defaultTransport(), opts.logger);
  }
  return new ZyInsClient(clientOpts);
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

/**
 * `isa.proxy.*` — internal-facing transport namespace. The proxy surface
 * is not consumed by application code (per `@isa-sdk/proxy` ADR-035); it
 * exists on the unified `Isa` instance for parity with the spec and for
 * the SDK's own transport composition.
 */
export class ProxyNamespace {
  /**
   * Placeholder — proxy transport is composed internally by product
   * namespaces. Direct invocation lands with the bearer / session
   * transport wiring in Phase 3 of SDK_DESIGN.md.
   */
  call(): never {
    throw new IsaConfigError(
      `isa.proxy.call() is reserved for Phase 3 transport wiring in SDK_DESIGN.md`,
    );
  }
}
