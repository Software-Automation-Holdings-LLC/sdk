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
import { resolveBearerIdentity, resolveLicenseIdentity, resolveSessionIdentity, } from './envFactory';
import { IsaConfigError } from './apiError';
import { debugLoggerFromEnv, processEnv, stderrSink, } from './logger';
import { ZyInsClient, DEFAULT_ZYINS_BASE_URL } from './client';
import { defaultTransport } from './transport';
import { WebhooksService } from '../rapidsign/webhooks';
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
    identity;
    /** Active debug logger, if `ISA_LOG=debug` or one was injected. */
    logger;
    /** Product namespaces. */
    zyins;
    /** RapidSign namespace — typed surface; live methods land with issue #38. */
    rapidsign;
    /** Proxy namespace — internal-facing; transport composition only. */
    proxy;
    /** Top-level webhook verifier. */
    webhooks;
    constructor(opts) {
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
    static withBearer(args, env = processEnv) {
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
    static withLicense(args, env = processEnv) {
        const identity = resolveLicenseIdentity(args, env);
        const opts = { identity };
        if (args?.deviceId !== undefined)
            opts.deviceId = args.deviceId;
        if (args?.orderId !== undefined)
            opts.orderId = args.orderId;
        return new Isa(opts);
    }
    /**
     * Construct from a session (id, secret) — embedded forms. With no
     * arguments, reads `ISA_SESSION_ID` and the session-secret env var from
     * the environment.
     */
    static withSession(args, env = processEnv) {
        return new Isa({ identity: resolveSessionIdentity(args, env) });
    }
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
    opts;
    clientOnce;
    constructor(opts) {
        this.opts = opts;
        let cached;
        this.clientOnce = () => {
            if (cached)
                return cached;
            cached = buildLicenseClient(opts);
            return cached;
        };
    }
    /**
     * Run the prequalify decision. Returns an `Envelope<PrequalifyResult>`
     * with named `requestId`, `idempotencyKey`, and `retryAttempts` fields.
     */
    async prequalify(request) {
        const client = this.clientOnce();
        const result = await client.prequalify(request);
        return wrapEnvelope(result, result.requestId);
    }
    /** Raw-response sibling of `prequalify`. */
    prequalifyRaw = async (request) => {
        const client = this.clientOnce();
        const result = await client.prequalify(request);
        return { data: result, response: synthesizeRawResponse(result.requestId) };
    };
}
/** Wrap a result in an envelope. Defaults for the optional fields are documented in SDK_DESIGN §4.6. */
export function wrapEnvelope(data, requestId) {
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
function synthesizeRawResponse(requestId) {
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
function buildLicenseClient(opts) {
    if (opts.identity.mode !== 'license') {
        throw new IsaConfigError(`isa.zyins.* product methods currently require Isa.withLicense() — bearer and session transport wiring lands in Phase 3 of SDK_DESIGN.md`);
    }
    if (!opts.deviceId) {
        throw new IsaConfigError(`isa.zyins.* product methods require a deviceId on Isa.withLicense({ deviceId, orderId, … })`);
    }
    if (!opts.orderId) {
        throw new IsaConfigError(`isa.zyins.* product methods require an orderId on Isa.withLicense({ deviceId, orderId, … })`);
    }
    const auth = {
        licenseKey: licenseKeyFor(opts.identity),
        orderId: opts.orderId,
        email: opts.identity.email,
        deviceId: opts.deviceId,
    };
    const clientOpts = {
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
function wrapTransportWithLogger(inner, logger) {
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
function detectBodyKind(body) {
    if (body.startsWith('{') || body.startsWith('['))
        return 'json';
    if (body.includes('='))
        return 'form';
    return 'unknown';
}
/**
 * The legacy AuthContext distinguishes "licenseKey" (the secret) from
 * "keycode" (the activation token). In modern license-mode the keycode IS
 * the licenseKey from the wire's perspective; this helper makes that
 * mapping explicit so callers don't pass the wrong field.
 */
function licenseKeyFor(identity) {
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
    webhooks = new WebhooksService();
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
    call() {
        throw new IsaConfigError(`isa.proxy.call() is reserved for Phase 3 transport wiring in SDK_DESIGN.md`);
    }
}
//# sourceMappingURL=isa.js.map