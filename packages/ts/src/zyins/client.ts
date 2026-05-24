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

import { type AuthContext } from './auth';
import { type Transport, defaultTransport } from './transport';
import { type Clock, systemClock } from '../core';
import {
  prequalify,
  type PrequalifyRequest,
  type PrequalifyResult,
} from './prequalify';
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
} from './license';
import { getReadiness, type ReadinessResult } from './health';
import { email, type CaseEmailRequest, type CaseEmailResult } from './case';
import { lookup as brandingLookup, type BrandingDetail } from './branding';
import { DatasetsSubClient } from './datasets';
import {
  lookup as preferencesLookup,
  set as preferencesSet,
  type PreferencesLookupResult,
  type PreferencesSetRequest,
  type PreferencesSetResult,
} from './preferences';
import {
  create as casesCreate,
  type CaseCreateRequest,
  type CaseCreateResult,
} from './cases';
import { LogosSubClient, type LogosFetch } from './logos';

/** Per-call context shared across sub-clients. */
export interface OperationContext {
  auth: AuthContext;
  baseUrl: string;
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
  /** Reference-data bundle (`isa.zyins.datasets.get()`). */
  public readonly datasets: DatasetsSubClient;

  constructor(options: ZyInsClientOptions) {
    this.auth = options.auth;
    this.baseUrl = options.baseUrl ?? DEFAULT_ZYINS_BASE_URL;
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
  }

  /** Run a prequalify call. See `PrequalifyRequest` for input shape. */
  async prequalify(request: PrequalifyRequest): Promise<PrequalifyResult> {
    return prequalify(request, this.context());
  }

  /** Internal: produce the shared context object every operation needs. */
  private context(): OperationContext {
    return {
      auth: this.auth,
      baseUrl: this.baseUrl,
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
 * Cases sub-client. Targets `POST /v1/case` for create and
 * `POST /v1/email/enqueue` for case-share email. Future `list`/`get`/
 * `delete` operations require net-new server work tracked in the design doc.
 */
class CasesSubClient {
  constructor(private readonly ctx: OperationContext) {}

  /**
   * Share a case (RW + optional analysis). Canonical surface per the locked
   * spec (Section 3 Flow 5 + Appendix B post-lock correction #2). The
   * recipient's UI decides RO vs RW based on whether `results` is present;
   * the SDK has no `mode` flag.
   */
  share(request: CaseCreateRequest): Promise<CaseCreateResult> {
    return casesCreate(request, this.ctx);
  }

  /**
   * @deprecated Use `share()` instead. `create()` is retained as a back-compat
   * alias and will be removed in v0.7.0. See
   * `/tmp/sdk-syntax-proposal.md` Appendix B post-lock correction #2.
   */
  create(request: CaseCreateRequest): Promise<CaseCreateResult> {
    return casesCreate(request, this.ctx);
  }

  email(request: CaseEmailRequest): Promise<CaseEmailResult> {
    return email(request, this.ctx);
  }
}
