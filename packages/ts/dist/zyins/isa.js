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
import { resolveBearerIdentity, resolveLicenseIdentity, resolveSessionIdentity, ENV_VAR_NAMES, } from './envFactory';
import { IsaConfigError } from './apiError';
import { CREDENTIAL_KEYS, inMemoryCredentialStore, loadOrMintDeviceId, mintDeviceId, } from '../core';
import { IsaCredentialState, } from './credentialState';
import { debugLoggerFromEnv, processEnv, stderrSink, } from './logger';
import { ZyInsClient, DEFAULT_ZYINS_BASE_URL } from './client';
import { defaultTransport } from './transport';
import { WebhooksService } from '../rapidsign/webhooks';
import { assertSessionIdentityForProxyCall, proxyCall as runProxyCall, } from '../proxy/call';
import { BrandingFacade, PreferencesFacade, CasesFacade, EmailFacade, LicensesFacade, LogosFacade, } from './isaNamespaces';
import { buildAccountNamespace } from '../account/factory';
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
    /**
     * `isa.account.*` — per-license account operations (branding, preferences,
     * cases, email, reference-data). License-HMAC auth path; constructed only
     * when the identity is a license. Bearer / session callers receive an
     * accessor that throws `IsaConfigError` on first use, matching the zyins
     * namespace pattern.
     */
    account;
    /** Top-level webhook verifier. */
    webhooks;
    /**
     * Shared credential state for license-mode `Isa` instances. Mutated in
     * place by `isa.zyins.licenses.activate()`; `undefined` for bearer /
     * session identities.
     */
    credentialState;
    constructor(opts) {
        this.identity = opts.identity;
        this.logger =
            opts.logger ??
                debugLoggerFromEnv(opts.env ?? processEnv, opts.logSink ?? stderrSink);
        this.credentialState = buildCredentialStateIfLicense(opts);
        if (this.credentialState && opts.onLicenseRefreshed) {
            this.credentialState.onLicenseRefreshed(opts.onLicenseRefreshed);
        }
        const nsOpts = { identity: opts.identity };
        if (opts.baseUrl !== undefined)
            nsOpts.baseUrl = opts.baseUrl;
        if (this.logger !== undefined)
            nsOpts.logger = this.logger;
        if (this.credentialState !== undefined)
            nsOpts.credentialState = this.credentialState;
        if (opts.transport !== undefined)
            nsOpts.transport = opts.transport;
        if (opts.logosFetch !== undefined)
            nsOpts.logosFetch = opts.logosFetch;
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
    onLicenseRefreshed(listener) {
        if (!this.credentialState) {
            throw new IsaConfigError('Isa.onLicenseRefreshed is available only on license-mode instances');
        }
        return this.credentialState.onLicenseRefreshed(listener);
    }
    /**
     * Construct from a bearer token (server-to-server `isa_live_…` tokens).
     * With no arguments, reads `ISA_TOKEN` from the environment. Throws
     * `IsaConfigError` when neither is supplied.
     */
    static withBearer(args, env = processEnv, options = {}) {
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
    static withLicense(args, env = processEnv, options = {}) {
        const identity = resolveLicenseIdentity(args, env);
        const opts = { identity, ...options };
        if (args?.deviceId !== undefined)
            opts.deviceId = args.deviceId;
        if (args?.orderId !== undefined)
            opts.orderId = args.orderId;
        if (args?.licenseKey !== undefined)
            opts.licenseKey = args.licenseKey;
        if (args?.credentialStore !== undefined)
            opts.credentialStore = args.credentialStore;
        if (args?.onLicenseRefreshed !== undefined)
            opts.onLicenseRefreshed = args.onLicenseRefreshed;
        if (args?.transport !== undefined)
            opts.transport = args.transport;
        return new Isa(opts);
    }
    /**
     * Async variant of {@link withLicense}. Probes the credential store for a
     * persisted `deviceId` + `licenseKey` BEFORE constructing the instance so
     * the very first call already has every credential it needs. Use this in
     * runtimes with persistent storage (React Native, browsers) to skip the
     * synchronous-mint fallback and reuse the device id across process boots.
     */
    static async withLicenseAsync(args, env = processEnv) {
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
    static fromEnv(env = processEnv) {
        if (env.get(ENV_VAR_NAMES.bearer.token))
            return Isa.withBearer(undefined, env);
        if (env.get(ENV_VAR_NAMES.license.keycode) && env.get(ENV_VAR_NAMES.license.email)) {
            return Isa.withLicense(undefined, env);
        }
        if (env.get(ENV_VAR_NAMES.session.sessionId) && env.get(ENV_VAR_NAMES.session.sessionSecret)) {
            return Isa.withSession(undefined, env);
        }
        throw new IsaConfigError(`Isa.fromEnv: no recognized credential in environment (set ${ENV_VAR_NAMES.bearer.token}, ${ENV_VAR_NAMES.license.keycode} + ${ENV_VAR_NAMES.license.email}, or ${ENV_VAR_NAMES.session.sessionId} + ${ENV_VAR_NAMES.session.sessionSecret})`);
    }
    /**
     * Construct from a session (id, secret) — embedded forms. With no
     * arguments, reads `ISA_SESSION_ID` and the session-secret env var from
     * the environment.
     */
    static withSession(args, env = processEnv, options = {}) {
        return new Isa({ identity: resolveSessionIdentity(args, env), ...options });
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
    /** `isa.zyins.branding` — whitelabel lookup. */
    branding;
    /** `isa.zyins.preferences` — per-license preferences document. */
    preferences;
    /** `isa.zyins.cases` — case create + share. */
    cases;
    /**
     * `isa.zyins.email` — transactional email enqueue. Today the only
     * server endpoint is `POST /v1/email/enqueue`; the SDK exposes it as
     * `email.enqueue` so future `list` / `get` RPCs land cleanly.
     */
    email;
    /**
     * `isa.zyins.prequalify` — callable that runs the prequalify decision
     * from a typed `PrequalifyRequest`. Carries a `legacyBlob` property for
     * consumers (bpp2.0) whose long-standing encoder produces the wire
     * payload directly and would have to restructure their call site to use
     * the typed shape.
     */
    prequalify;
    /** `isa.zyins.licenses` — license lifecycle (activate / check / deactivate). */
    licenses;
    /** `isa.zyins.logos` — carrier-logo asset lookup (public, no auth). */
    logos;
    constructor(opts) {
        this.opts = opts;
        let cached;
        this.clientOnce = () => {
            if (cached)
                return cached;
            cached = buildLicenseClient(opts);
            return cached;
        };
        this.branding = new BrandingFacade(this.clientOnce);
        this.preferences = new PreferencesFacade(this.clientOnce);
        this.cases = new CasesFacade(this.clientOnce);
        this.email = new EmailFacade(this.clientOnce);
        this.prequalify = buildPrequalifyCallable(this.clientOnce);
        this.licenses = buildLicensesFacade(opts);
        this.logos = new LogosFacade(opts.baseUrl ?? DEFAULT_ZYINS_BASE_URL, opts.logosFetch);
    }
    /** Raw-response sibling of `prequalify`. */
    prequalifyRaw = async (request) => {
        const client = this.clientOnce();
        const result = await client.prequalify(request);
        return { data: result, response: synthesizeRawResponse(result.requestId) };
    };
}
/**
 * Build the `prequalify` callable with the `legacyBlob` property attached.
 * The same `clientOnce` thunk backs both entry points so they share one
 * lazily-constructed client (and therefore one resolved auth context).
 */
function buildPrequalifyCallable(clientOnce) {
    const callable = (async (request) => {
        const client = clientOnce();
        const result = await client.prequalify(request);
        return wrapEnvelope(result, result.requestId);
    });
    callable.legacyBlob = async (request) => {
        const client = clientOnce();
        const result = await client.prequalifyLegacyBlob(request);
        return wrapEnvelope(result, result.requestId);
    };
    return callable;
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
    if (!opts.credentialState) {
        throw new IsaConfigError('isa.zyins.* product methods require a credential state (constructed by Isa.withLicense)');
    }
    const clientOpts = {
        auth: opts.credentialState.auth,
        baseUrl: opts.baseUrl ?? DEFAULT_ZYINS_BASE_URL,
    };
    const baseTransport = guardTransportWithLicenseKey(opts.logger
        ? wrapTransportWithLogger(opts.transport ?? defaultTransport(), opts.logger)
        : (opts.transport ?? defaultTransport()), opts.credentialState);
    clientOpts.transport = baseTransport;
    if (opts.logosFetch) {
        clientOpts.logosFetch = opts.logosFetch;
    }
    return new ZyInsClient(clientOpts);
}
function guardTransportWithLicenseKey(inner, state) {
    return async (request) => {
        if (!state.auth.licenseKey.trim()) {
            throw new IsaConfigError('isa.zyins.* product methods require an active licenseKey; call isa.zyins.licenses.activate() first');
        }
        return inner(request);
    };
}
function buildLicensesTransport(opts) {
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
function buildLicensesFacade(opts) {
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
function licensesNotConfigured() {
    const fail = () => {
        throw new IsaConfigError('isa.zyins.licenses requires Isa.withLicense({ keycode, email, ... })');
    };
    return new Proxy(Object.create(LicensesFacade.prototype), {
        get: () => fail,
    });
}
/**
 * Construct the {@link IsaCredentialState} for license-mode instances.
 * Returns `undefined` for bearer / session identities; those modes do not
 * use the license HMAC auth path yet.
 */
function buildCredentialStateIfLicense(opts) {
    if (opts.identity.mode !== 'license')
        return undefined;
    const store = opts.credentialStore ?? inMemoryCredentialStore();
    const deviceId = opts.deviceId ?? mintDeviceId();
    if (!opts.deviceId) {
        // Persist the freshly minted id so subsequent calls (and process boots
        // sharing the store) reuse the same value. Best-effort — failures are
        // swallowed because in-memory stores never fail, and a downstream
        // failure on a third-party store must not block construction.
        void store.set(CREDENTIAL_KEYS.deviceId, deviceId).catch(() => { });
    }
    const orderId = opts.orderId ?? licenseKeyFor(opts.identity);
    const licenseKey = opts.licenseKey ?? '';
    return new IsaCredentialState({
        keycode: licenseKeyFor(opts.identity),
        email: opts.identity.email,
        deviceId,
        licenseKey,
        orderId,
    }, store);
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
/** Default origin for the platform proxy `/v1/call` endpoint. */
export const DEFAULT_PROXY_ORIGIN = 'https://proxy.isaapi.com';
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
    opts;
    constructor(opts) {
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
    async call(opts) {
        const identity = this.opts.identity;
        assertSessionIdentityForProxyCall(identity);
        return runProxyCall({ proxyOrigin: this.opts.proxyOrigin, identity }, opts);
    }
}
//# sourceMappingURL=isa.js.map