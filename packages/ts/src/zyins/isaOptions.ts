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
import {
  type IsaApiVersion,
  type IsaApiVersionOverride,
  type IsaApiSurface,
  BundledApiVersions,
  resolveApiVersions,
} from './bundledApiVersions';

export type { IsaApiVersion, IsaApiVersionOverride, IsaApiSurface };
export { BundledApiVersions, resolveApiVersions };

/**
 * Tagged auth supplier accepted by {@link IsaCreateOptions.auth}. Each
 * variant carries the material the matching factory requires; a single
 * dispatch in `Isa.create` picks the correct legacy factory.
 */
export type IsaAuthSupplier =
  | { readonly kind: 'bearer'; readonly token?: string }
  | {
      readonly kind: 'license';
      readonly keycode?: string;
      readonly email?: string;
      readonly orderId?: string;
      readonly licenseKey?: string;
      readonly credentialStore?: CredentialStore;
      readonly onLicenseRefreshed?: LicenseRefreshedListener;
    }
  | { readonly kind: 'form'; readonly formToken: string }
  | { readonly kind: 'session'; readonly sessionId: string; readonly sessionSecret: string };

/**
 * Bearer-auth supplier factory. Resolves a server-to-server `isa_live_…`
 * token from the explicit argument or, when omitted, from `ISA_TOKEN`.
 */
export const BearerAuth = {
  /** Construct from an explicit token. */
  fromToken(token: string): IsaAuthSupplier {
    return { kind: 'bearer', token };
  },
  /** Construct from `ISA_TOKEN` at factory time. */
  fromEnv(): IsaAuthSupplier {
    return { kind: 'bearer' };
  },
} as const;

/**
 * License-auth supplier factory. Resolves `(keycode, email)` from the
 * explicit args or, when omitted, from `ISA_LICENSE_KEYCODE` +
 * `ISA_LICENSE_EMAIL`.
 */
export const LicenseAuth = {
  /** Construct from explicit keycode + email. */
  fromKeycode(
    keycode: string,
    email: string,
    extras?: Omit<
      Extract<IsaAuthSupplier, { kind: 'license' }>,
      'kind' | 'keycode' | 'email'
    >,
  ): IsaAuthSupplier {
    return { kind: 'license', keycode, email, ...(extras ?? {}) };
  },
  /** Construct from environment variables at factory time. */
  fromEnv(): IsaAuthSupplier {
    return { kind: 'license' };
  },
} as const;

/** Form-token auth supplier factory (embedded eApp). */
export const FormAuth = {
  fromToken(formToken: string): IsaAuthSupplier {
    return { kind: 'form', formToken };
  },
} as const;

/**
 * Tagged engine selector — every variant exposes the same product API
 * surface so consumer code stays identical when targeting different
 * deployments. Values are interpreted by `Isa.create` to set `baseUrl`
 * (and proxyOrigin where applicable).
 */
export type IsaEngine =
  | { readonly kind: 'remote'; readonly baseUrl: string }
  | { readonly kind: 'local'; readonly baseUrl: string }
  | { readonly kind: 'proxy'; readonly proxyOrigin: string }
  | { readonly kind: 'in_memory'; readonly transport: Transport };

const PRODUCTION_REMOTE_ORIGIN = 'https://zyins.isaapi.com';
const PRODUCTION_PROXY_ORIGIN = 'https://proxy.isaapi.com';
const IN_MEMORY_TRANSPORT_ERROR =
  'InMemoryEngine requires inMemoryEngineWith(transport) before product calls';

/** Production ZyINS endpoint (`https://zyins.isaapi.com`). */
export const RemoteEngine = {
  /** Default — production endpoint. */
  default: { kind: 'remote', baseUrl: PRODUCTION_REMOTE_ORIGIN } as IsaEngine,
  /** Construct from an explicit base URL (staging, region-specific). */
  at(baseUrl: string): IsaEngine {
    return { kind: 'remote', baseUrl };
  },
} as const;

/** Local engine binary — points at a developer or test endpoint. */
export const LocalEngine = {
  at(baseUrl: string): IsaEngine {
    return { kind: 'local', baseUrl };
  },
} as const;

/** Routes through the platform proxy (`/v1/call`). */
export const ProxyEngine = {
  default: { kind: 'proxy', proxyOrigin: PRODUCTION_PROXY_ORIGIN } as IsaEngine,
  at(proxyOrigin: string): IsaEngine {
    return { kind: 'proxy', proxyOrigin };
  },
} as const;

/**
 * In-process mock — bypasses HTTP entirely. Test-only; pass an injected
 * transport to satisfy the same surface used by real engines.
 */
export const InMemoryEngine: IsaEngine = {
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
export function inMemoryEngineWith(transport: Transport): IsaEngine {
  return { kind: 'in_memory', transport };
}

/** Default per-call timeout in milliseconds. */
export const DEFAULT_TIMEOUT_MS = 30_000;

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
export function resolveIsaOptions(opts: IsaCreateOptions): ResolvedIsaOptions {
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

function engineBaseUrl(engine: IsaEngine): string {
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
