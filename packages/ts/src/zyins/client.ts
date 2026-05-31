/**
 * Tier 3 ZyINS client.
 *
 * The class is the explicit-context idiom from ADR-035: the caller passes
 * `auth` at construction (or each sub-method call carries its own context).
 * The `react/useZyIns` and `vue/useZyIns` helpers wrap this class for the
 * context-bound idiom; the underlying logic is the same in both cases.
 *
 * Injectable facades:
 *   - `transport`: HTTP layer (defaults to `defaultTransport()`).
 *   - `clock`:     time source (defaults to `systemClock`).
 *
 * Locked invariants (per ADR-035 "invariants over options"):
 *   - `baseUrl` defaults to the production ZyINS endpoint; staging is opt-in.
 *   - Idempotency keys are derived; no `options.idempotencyKey` on Tier 3
 *     surface beyond an internal override used by replay tests.
 *   - Retries and backoff are NOT exposed here; they live in Tier 2.
 */

import { type AuthContext } from './auth.js';
import { type Transport, defaultTransport } from './transport.js';
import { type Clock, systemClock } from '../core/index.js';
import {
  prequalify,
  type PrequalifyRequest,
  type PrequalifyResult,
} from './prequalify.js';
import {
  prequalifyV2,
  type PrequalifyV2Request,
  type PrequalifyV2Result,
} from './prequalify-v2.js';
import {
  prequalifyV3,
  type PrequalifyV3Request,
  type PrequalifyV3Result,
} from './prequalify-v3.js';
import {
  quoteV3,
  type QuoteV3Request,
  type QuoteV3Result,
} from './quote-v3.js';
import { DatasetsV3SubClient } from './datasets-v3.js';
import {
  activate as licenseActivate,
  check as licenseCheck,
  deactivate as licenseDeactivate,
  type LicenseActivateRequest,
  type LicenseActivateResult,
  type LicenseCheckRequest,
  type LicenseCheckResult,
  type LicenseDeactivateRequest,
  type LicenseDeactivateResult,
} from './license.js';
import { getReadiness, type ReadinessResult } from './health.js';
import { email, type CaseEmailRequest, type CaseEmailResult } from './case.js';
import { lookup as brandingLookup, type BrandingDetail } from './branding.js';
import { DatasetsSubClient } from './datasets.js';
import {
  lookup as preferencesLookup,
  set as preferencesSet,
  type PreferencesLookupResult,
  type PreferencesSetRequest,
  type PreferencesSetResult,
} from './preferences.js';
import {
  share as casesShare,
  type CaseShareRequest,
  type CaseShareResult,
} from './cases.js';
import { DEFAULT_CASE_VIEWER_BASE_URL } from '../account/cases.js';
import { LogosSubClient, type LogosFetch } from './logos.js';

/** Per-call context shared across sub-clients. */
export interface OperationContext {
  auth: AuthContext;
  baseUrl: string;
  /** Viewer origin for case share links; defaults via {@link ZyInsClientOptions}. */
  caseViewerBaseUrl: string;
  transport: Transport;
  clock: Clock;
}

/** Production ZyINS endpoint. Override only for staging / local. */
export const DEFAULT_ZYINS_BASE_URL = 'https://zyins.isaapi.com';

/** Construction options for `ZyInsClient`. */
export interface ZyInsClientOptions {
  /** Auth identity. Required. */
  auth: AuthContext;
  /** Base URL override; defaults to {@link DEFAULT_ZYINS_BASE_URL}. */
  baseUrl?: string;
  /**
   * Viewer origin for case share links; defaults to
   * {@link DEFAULT_CASE_VIEWER_BASE_URL}. The SDK appends `/c/<id>#k=<key>`,
   * so the base must NOT include `/c/`.
   */
  caseViewerBaseUrl?: string;
  /** Transport override; defaults to {@link defaultTransport}. */
  transport?: Transport;
  /** Clock override; defaults to {@link systemClock}. */
  clock?: Clock;
  /**
   * Logos fetcher override. The `/v1/logos/{carrier}` endpoint returns
   * binary bytes by default, which the standard string-bodied {@link Transport}
   * cannot carry; logos therefore uses a dedicated facade that tests inject
   * here. Production defaults to `globalThis.fetch`.
   */
  logosFetch?: LogosFetch;
}

/**
 * The Tier 3 ZyINS client. Construct once per auth context; methods are
 * grouped under typed sub-clients (`license`, `case`) for discoverability.
 * `prequalify` lives at the top level because it is the single most common
 * call.
 */
export class ZyInsClient {
  private readonly auth: AuthContext;
  private readonly baseUrl: string;
  private readonly caseViewerBaseUrl: string;
  private readonly transport: Transport;
  private readonly clock: Clock;
  private readonly logosFetch: LogosFetch | undefined;

  /**
   * Proto-backed license-lifecycle sub-client. Targets `/v1/licenses/*`.
   * The TS surface is singular: a device has exactly one license.
   */
  public readonly license: LicenseSubClient;
  /** Platform readiness probe (`/ready`). Unauthenticated. */
  public readonly health: HealthSubClient;
  public readonly case: CaseSubClient;
  /** Whitelabel branding lookup. See `branding.ts`. */
  public readonly branding: BrandingSubClient;
  /** Per-license preferences document storage. See `preferences.ts`. */
  public readonly preferences: PreferencesSubClient;
  /** Case create + share. See `cases.ts`. */
  public readonly cases: CasesSubClient;
  /** Carrier-logo lookup. See `logos.ts`. */
  public readonly logos: LogosSubClient;
  /**
   * Legacy v2 reference-data bundle. Prefer `datasetsV3` for new code;
   * the SDK's public `isa.zyins.datasets` facade routes to v3.
   */
  public readonly datasets: DatasetsSubClient;
  /** v3 reference catalog (`GET /v3/datasets`). */
  public readonly datasetsV3: DatasetsV3SubClient;

  constructor(options: ZyInsClientOptions) {
    this.auth = options.auth;
    this.baseUrl = options.baseUrl ?? DEFAULT_ZYINS_BASE_URL;
    this.caseViewerBaseUrl = options.caseViewerBaseUrl ?? DEFAULT_CASE_VIEWER_BASE_URL;
    this.transport = options.transport ?? defaultTransport();
    this.clock = options.clock ?? systemClock;
    this.logosFetch = options.logosFetch;
    this.license = new LicenseSubClient(this.context());
    this.health = new HealthSubClient(this.context());
    this.case = new CaseSubClient(this.context());
    this.branding = new BrandingSubClient(this.context());
    this.preferences = new PreferencesSubClient(this.context());
    this.cases = new CasesSubClient(this.context());
    this.logos = new LogosSubClient(this.baseUrl, this.logosFetch);
    this.datasets = new DatasetsSubClient(this.context());
    this.datasetsV3 = new DatasetsV3SubClient(this.context());
  }

  /** Run a prequalify call. See `PrequalifyRequest` for input shape. */
  async prequalify(request: PrequalifyRequest): Promise<PrequalifyResult> {
    return prequalify(request, this.context());
  }

  /**
   * Run the v2 prequalify call (`POST /v2/prequalify`). Returns one
   * `PlanOffer` per product with the best qualifying tier at the top
   * level and alternates in `other_offers[]`. Pass
   * `options: { includeIneligible: true }` to also receive declined
   * products / declined alternates.
   */
  async prequalifyV2(request: PrequalifyV2Request): Promise<PrequalifyV2Result> {
    return prequalifyV2(request, this.context());
  }

  /**
   * Run the v3 prequalify call (`POST /v3/prequalify`). Returns one
   * offer per product with a uniform `pricing[]` table — each row is a
   * rate class carrying its own eligibility, premium, and rank. Array
   * order of `pricing` is authoritative for display.
   */
  async prequalifyV3(request: PrequalifyV3Request): Promise<PrequalifyV3Result> {
    return prequalifyV3(request, this.context());
  }

  /**
   * Run the v3 quote call (`POST /v3/quote`). Returns qualifying
   * products grouped by requested amount with the same uniform
   * `pricing[]` table as v3 prequalify.
   */
  async quoteV3(request: QuoteV3Request): Promise<QuoteV3Result> {
    return quoteV3(request, this.context());
  }

  /** Internal: produce the shared context object every operation needs. */
  private context(): OperationContext {
    return {
      auth: this.auth,
      baseUrl: this.baseUrl,
      caseViewerBaseUrl: this.caseViewerBaseUrl,
      transport: this.transport,
      clock: this.clock,
    };
  }
}

/**
 * Proto-backed license-lifecycle sub-client. Targets `/v1/licenses/activate`,
 * `/v1/licenses/check`, and `/v1/licenses/deactivate`. The TS surface is
 * singular (one license per device); the wire paths remain plural.
 */
class LicenseSubClient {
  constructor(private readonly ctx: OperationContext) {}

  activate(request: LicenseActivateRequest): Promise<LicenseActivateResult> {
    return licenseActivate(request, this.ctx);
  }

  check(request: LicenseCheckRequest): Promise<LicenseCheckResult> {
    return licenseCheck(request, this.ctx);
  }

  deactivate(request: LicenseDeactivateRequest): Promise<LicenseDeactivateResult> {
    return licenseDeactivate(request, this.ctx);
  }
}

/** Platform readiness sub-client. Targets `/ready` (no auth). */
class HealthSubClient {
  constructor(private readonly ctx: OperationContext) {}

  getReadiness(): Promise<ReadinessResult> {
    return getReadiness({ baseUrl: this.ctx.baseUrl, transport: this.ctx.transport });
  }
}

/** Sub-client exposing case-level operations (email, future: pdf, send). */
class CaseSubClient {
  constructor(private readonly ctx: OperationContext) {}

  email(request: CaseEmailRequest): Promise<CaseEmailResult> {
    return email(request, this.ctx);
  }
}

/** Whitelabel branding sub-client. Targets `GET /v1/branding`. */
class BrandingSubClient {
  constructor(private readonly ctx: OperationContext) {}

  lookup(): Promise<BrandingDetail> {
    return brandingLookup(this.ctx);
  }
}

/** Preferences sub-client. Targets `GET` / `POST /v1/preferences`. */
class PreferencesSubClient {
  constructor(private readonly ctx: OperationContext) {}

  lookup(): Promise<PreferencesLookupResult> {
    return preferencesLookup(this.ctx);
  }

  set(request: PreferencesSetRequest): Promise<PreferencesSetResult> {
    return preferencesSet(request, this.ctx);
  }
}

/**
 * Cases sub-client. `share` stores an opaque, client-encrypted case via the
 * zero-knowledge `/v1/case` store and returns the fragment-keyed link;
 * `email` enqueues a case email. The decryption key never reaches the server.
 */
class CasesSubClient {
  constructor(private readonly ctx: OperationContext) {}

  /**
   * Surface the bound signed-request context so the unified `Isa`
   * namespace can construct a `ZeroKnowledgeCaseStorage` adapter without
   * duplicating the auth/transport/clock plumbing. Internal — not part of
   * the published SDK surface.
   */
  get context(): OperationContext {
    return this.ctx;
  }

  /**
   * Share a zyins case (input + optional analysis snapshot). Encrypts
   * client-side and returns the fragment-keyed link. The recipient's UI
   * decides RO vs RW based on whether `results` is present; the SDK has no
   * `mode` flag.
   *
   * @example
   * ```ts
   * const { id, link } = await isa.zyins.cases.share({
   *   input: currentCaseToJSON(),
   * });
   * ```
   */
  share(request: CaseShareRequest): Promise<CaseShareResult> {
    return casesShare(request, this.ctx);
  }

  /**
   * @deprecated Use `share()` instead. `create()` is a back-compat alias that
   * forwards to the same opaque-case flow; removed in v0.7.0.
   *
   * @example
   * ```ts
   * const { id, link } = await isa.zyins.cases.create({ input });
   * ```
   */
  create(request: CaseShareRequest): Promise<CaseShareResult> {
    return casesShare(request, this.ctx);
  }

  email(request: CaseEmailRequest): Promise<CaseEmailResult> {
    return email(request, this.ctx);
  }
}
