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
import type { CredentialStore } from '../core';
import type { LicenseRefreshedListener } from './credentialState';
import { type Transport } from './transport';
import { type IsaApiVersion, type IsaApiVersionOverride, type IsaApiSurface, BundledApiVersions, resolveApiVersions } from './bundledApiVersions';
export type { IsaApiVersion, IsaApiVersionOverride, IsaApiSurface };
export { BundledApiVersions, resolveApiVersions };
/**
 * Tagged auth supplier accepted by {@link IsaCreateOptions.auth}. Each
 * variant carries the material the matching factory requires; a single
 * dispatch in `Isa.create` picks the correct legacy factory.
 */
export type IsaAuthSupplier = {
    readonly kind: 'bearer';
    readonly token?: string;
} | {
    readonly kind: 'license';
    readonly keycode?: string;
    readonly email?: string;
    readonly orderId?: string;
    readonly licenseKey?: string;
    readonly credentialStore?: CredentialStore;
    readonly onLicenseRefreshed?: LicenseRefreshedListener;
} | {
    readonly kind: 'form';
    readonly formToken: string;
} | {
    readonly kind: 'session';
    readonly sessionId: string;
    readonly sessionSecret: string;
};
/**
 * Bearer-auth supplier factory. Resolves a server-to-server `isa_live_…`
 * token from the explicit argument or, when omitted, from `ISA_TOKEN`.
 */
export declare const BearerAuth: {
    /** Construct from an explicit token. */
    readonly fromToken: (token: string) => IsaAuthSupplier;
    /** Construct from `ISA_TOKEN` at factory time. */
    readonly fromEnv: () => IsaAuthSupplier;
};
/**
 * License-auth supplier factory. Resolves `(keycode, email)` from the
 * explicit args or, when omitted, from `ISA_LICENSE_KEYCODE` +
 * `ISA_LICENSE_EMAIL`.
 */
export declare const LicenseAuth: {
    /** Construct from explicit keycode + email. */
    readonly fromKeycode: (keycode: string, email: string, extras?: Omit<Extract<IsaAuthSupplier, {
        kind: "license";
    }>, "kind" | "keycode" | "email">) => IsaAuthSupplier;
    /** Construct from environment variables at factory time. */
    readonly fromEnv: () => IsaAuthSupplier;
};
/** Form-token auth supplier factory (embedded eApp). */
export declare const FormAuth: {
    readonly fromToken: (formToken: string) => IsaAuthSupplier;
};
/**
 * Tagged engine selector — every variant exposes the same product API
 * surface so consumer code stays identical when targeting different
 * deployments. Values are interpreted by `Isa.create` to set `baseUrl`
 * (and proxyOrigin where applicable).
 */
export type IsaEngine = {
    readonly kind: 'remote';
    readonly baseUrl: string;
} | {
    readonly kind: 'local';
    readonly baseUrl: string;
} | {
    readonly kind: 'proxy';
    readonly proxyOrigin: string;
} | {
    readonly kind: 'in_memory';
    readonly transport: Transport;
};
/** Production ZyINS endpoint (`https://zyins.isaapi.com`). */
export declare const RemoteEngine: {
    /** Default — production endpoint. */
    readonly default: IsaEngine;
    /** Construct from an explicit base URL (staging, region-specific). */
    readonly at: (baseUrl: string) => IsaEngine;
};
/** Local engine binary — points at a developer or test endpoint. */
export declare const LocalEngine: {
    readonly at: (baseUrl: string) => IsaEngine;
};
/** Routes through the platform proxy (`/v1/call`). */
export declare const ProxyEngine: {
    readonly default: IsaEngine;
    readonly at: (proxyOrigin: string) => IsaEngine;
};
/**
 * In-process mock — bypasses HTTP entirely. Test-only; pass an injected
 * transport to satisfy the same surface used by real engines.
 */
export declare const InMemoryEngine: IsaEngine;
/**
 * Construct an in-memory engine backed by a custom transport. Useful when
 * tests want to assert on outbound request shape without the default
 * transport's network hop.
 */
export declare function inMemoryEngineWith(transport: Transport): IsaEngine;
/** Default per-call timeout in milliseconds. */
export declare const DEFAULT_TIMEOUT_MS = 30000;
/**
 * Options accepted by `Isa.create()`. Every field is optional except
 * `auth`; defaults match the production posture.
 */
export interface IsaCreateOptions {
    /** Auth supplier. See {@link BearerAuth}, {@link LicenseAuth}, {@link FormAuth}. */
    auth: IsaAuthSupplier;
    /** Engine selector. Defaults to {@link RemoteEngine.default}. */
    engine?: IsaEngine;
    /** Per-call timeout in ms. Defaults to {@link DEFAULT_TIMEOUT_MS}. */
    timeout?: number;
    /**
     * Per-surface API-version override. Surfaces absent from the override
     * fall back to {@link BundledApiVersions}. There is no shorthand string
     * form and no `default` key.
     */
    apiVersion?: IsaApiVersionOverride;
    /** Viewer origin used to assemble case share links. */
    caseViewerBaseUrl?: string;
    /** Optional consumer build identifier for client-version negotiation. */
    clientVersion?: string;
    /** Transport override applied AFTER engine selection (test only). */
    transport?: Transport;
    /**
     * Optional case-storage adapter. Defaults to
     * {@link import('./cases/ZeroKnowledgeCaseStorage').ZeroKnowledgeCaseStorage}
     * — client-side AES-256-GCM, opaque ciphertext on the wire, fragment
     * key as the recall token. Carrier adapters may substitute a portal-
     * backed store; the SDK only sees the {@link CaseStorage} interface.
     */
    caseStorage?: import('./cases/CaseStorage').CaseStorage;
}
/** Resolved view of `IsaCreateOptions` with defaults applied. */
export interface ResolvedIsaOptions {
    readonly auth: IsaAuthSupplier;
    readonly engine: IsaEngine;
    readonly timeoutMs: number;
    /** Fully-resolved per-surface version map (override overlaid on bundled). */
    readonly apiVersions: Readonly<Record<IsaApiSurface, IsaApiVersion>>;
    readonly caseViewerBaseUrl: string | undefined;
    readonly clientVersion: string | undefined;
    readonly transport: Transport | undefined;
    readonly baseUrl: string;
    readonly proxyOrigin: string | undefined;
    readonly caseStorage: import('./cases/CaseStorage').CaseStorage | undefined;
}
/**
 * Resolve `IsaCreateOptions` into a fully-defaulted view. Pure — no side
 * effects, safe to call from constructors and tests alike.
 */
export declare function resolveIsaOptions(opts: IsaCreateOptions): ResolvedIsaOptions;
//# sourceMappingURL=isaOptions.d.ts.map