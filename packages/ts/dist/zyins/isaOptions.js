/**
 * Typed options-bag constructor sugar for `Isa`.
 *
 * The historic factories (`Isa.withBearer`, `Isa.withKeycode`,
 * `Isa.forForm`, `Isa.authenticate`) remain the canonical primitives; this
 * surface is the recommended path going forward and matches the
 * cross-language SDK shape (C# `new Isa(new IsaOptions { Auth = … })`).
 *
 * ```ts
 * const isa = await Isa.create({
 *   auth: BearerAuth.fromToken('isa_live_…'),
 *   engine: RemoteEngine.default,
 *   timeout: 30_000,
 *   apiVersion: 'v2',
 * });
 * ```
 *
 * `apiVersion` is immutable per-instance and pinned via the `Api-Version`
 * request header. `'v2'` (default) routes `prequalify` to `/v2/prequalify`
 * and returns the typed offer envelope. `'v1'` preserves the legacy
 * contract for callers still wired against the old envelope.
 */
import { BundledApiVersions, resolveApiVersions, } from './bundledApiVersions';
export { BundledApiVersions, resolveApiVersions };
/**
 * Bearer-auth supplier factory. Resolves a server-to-server `isa_live_…`
 * token from the explicit argument or, when omitted, from `ISA_TOKEN`.
 */
export const BearerAuth = {
    /** Construct from an explicit token. */
    fromToken(token) {
        return { kind: 'bearer', token };
    },
    /** Construct from `ISA_TOKEN` at factory time. */
    fromEnv() {
        return { kind: 'bearer' };
    },
};
/**
 * License-auth supplier factory. Resolves `(keycode, email)` from the
 * explicit args or, when omitted, from `ISA_LICENSE_KEYCODE` +
 * `ISA_LICENSE_EMAIL`.
 */
export const LicenseAuth = {
    /** Construct from explicit keycode + email. */
    fromKeycode(keycode, email, extras) {
        return { kind: 'license', keycode, email, ...(extras ?? {}) };
    },
    /** Construct from environment variables at factory time. */
    fromEnv() {
        return { kind: 'license' };
    },
};
/** Form-token auth supplier factory (embedded eApp). */
export const FormAuth = {
    fromToken(formToken) {
        return { kind: 'form', formToken };
    },
};
const PRODUCTION_REMOTE_ORIGIN = 'https://zyins.isaapi.com';
const PRODUCTION_PROXY_ORIGIN = 'https://proxy.isaapi.com';
const IN_MEMORY_TRANSPORT_ERROR = 'InMemoryEngine requires inMemoryEngineWith(transport) before product calls';
/** Production ZyINS endpoint (`https://zyins.isaapi.com`). */
export const RemoteEngine = {
    /** Default — production endpoint. */
    default: { kind: 'remote', baseUrl: PRODUCTION_REMOTE_ORIGIN },
    /** Construct from an explicit base URL (staging, region-specific). */
    at(baseUrl) {
        return { kind: 'remote', baseUrl };
    },
};
/** Local engine binary — points at a developer or test endpoint. */
export const LocalEngine = {
    at(baseUrl) {
        return { kind: 'local', baseUrl };
    },
};
/** Routes through the platform proxy (`/v1/call`). */
export const ProxyEngine = {
    default: { kind: 'proxy', proxyOrigin: PRODUCTION_PROXY_ORIGIN },
    at(proxyOrigin) {
        return { kind: 'proxy', proxyOrigin };
    },
};
/**
 * In-process mock — bypasses HTTP entirely. Test-only; pass an injected
 * transport to satisfy the same surface used by real engines.
 */
export const InMemoryEngine = {
    kind: 'in_memory',
    transport: async () => {
        throw new Error(IN_MEMORY_TRANSPORT_ERROR);
    },
};
/**
 * Construct an in-memory engine backed by a custom transport. Useful when
 * tests want to assert on outbound request shape without the default
 * transport's network hop.
 */
export function inMemoryEngineWith(transport) {
    return { kind: 'in_memory', transport };
}
/** Default per-call timeout in milliseconds. */
export const DEFAULT_TIMEOUT_MS = 30_000;
/**
 * Resolve `IsaCreateOptions` into a fully-defaulted view. Pure — no side
 * effects, safe to call from constructors and tests alike.
 */
export function resolveIsaOptions(opts) {
    const engine = opts.engine ?? RemoteEngine.default;
    const baseUrl = engineBaseUrl(engine);
    const proxyOrigin = engine.kind === 'proxy' ? engine.proxyOrigin : undefined;
    const engineTransport = engine.kind === 'in_memory' ? engine.transport : undefined;
    const transport = opts.transport ?? engineTransport;
    return {
        auth: opts.auth,
        engine,
        timeoutMs: opts.timeout ?? DEFAULT_TIMEOUT_MS,
        apiVersions: resolveApiVersions(opts.apiVersion),
        caseViewerBaseUrl: opts.caseViewerBaseUrl,
        clientVersion: opts.clientVersion,
        transport,
        baseUrl,
        proxyOrigin,
        caseStorage: opts.caseStorage,
    };
}
function engineBaseUrl(engine) {
    switch (engine.kind) {
        case 'remote':
        case 'local':
            return engine.baseUrl;
        case 'proxy':
            return PRODUCTION_REMOTE_ORIGIN;
        case 'in_memory':
            return PRODUCTION_REMOTE_ORIGIN;
    }
}
//# sourceMappingURL=isaOptions.js.map