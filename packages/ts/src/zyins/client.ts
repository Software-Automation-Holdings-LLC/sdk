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
  prequalifyLegacyBlob,
  type PrequalifyLegacyBlobRequest,
  type PrequalifyRequest,
  type PrequalifyResult,
} from './prequalify';
import {
  activate,
  deactivate,
  check,
  type LicenseActivateResult,
  type LicenseCheckResult,
} from './license';
import {
  activate as licensesActivate,
  check as licensesCheck,
  deactivate as licensesDeactivate,
  type LicensesActivateRequest,
  type LicensesActivateResult,
  type LicensesCheckRequest,
  type LicensesCheckResult,
  type LicensesDeactivateRequest,
  type LicensesDeactivateResult,
} from './licenses';
import { getReadiness, type ReadinessResult } from './health';
import { email, type CaseEmailRequest, type CaseEmailResult } from './case';
import { lookup as brandingLookup, type BrandingDetail } from './branding';
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
interface OperationContext {
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
   * @deprecated Hits the legacy `/v1/licensing` CGI surface. Use
   * {@link licenses} (plural) for new code; it targets the proto-backed
   * `/v1/licenses/check` and `/v1/licenses/deactivate` endpoints.
   */
  public readonly license: LicenseSubClient;
  /**
   * Proto-backed license-lifecycle sub-client. Replaces {@link license}
   * for new code.
   */
  public readonly licenses: LicensesSubClient;
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

  constructor(options: ZyInsClientOptions) {
    this.auth = options.auth;
    this.baseUrl = options.baseUrl ?? DEFAULT_ZYINS_BASE_URL;
    this.transport = options.transport ?? defaultTransport();
    this.clock = options.clock ?? systemClock;
    this.logosFetch = options.logosFetch;
    this.license = new LicenseSubClient(this.context());
    this.licenses = new LicensesSubClient(this.context());
    this.health = new HealthSubClient(this.context());
    this.case = new CaseSubClient(this.context());
    this.branding = new BrandingSubClient(this.context());
    this.preferences = new PreferencesSubClient(this.context());
    this.cases = new CasesSubClient(this.context());
    this.logos = new LogosSubClient(this.baseUrl, this.logosFetch);
  }

  /** Run a prequalify call. See `PrequalifyRequest` for input shape. */
  async prequalify(request: PrequalifyRequest): Promise<PrequalifyResult> {
    return prequalify(request, this.context());
  }

  /**
   * Run a prequalify call from a pre-encoded legacy payload. Mirrors
   * `prequalify` but accepts an opaque encoded blob produced by a legacy
   * encoder (e.g. bpp2.0's `prepEncObj` / `prepEncObjV2`) and sends it as
   * the request body verbatim. Returns the same typed `PrequalifyResult`.
   */
  async prequalifyLegacyBlob(
    request: PrequalifyLegacyBlobRequest,
  ): Promise<PrequalifyResult> {
    return prequalifyLegacyBlob(request, this.context());
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
 * @deprecated Legacy CGI sub-client. Use {@link LicensesSubClient}
 * for new code.
 */
class LicenseSubClient {
  constructor(private readonly ctx: OperationContext) {}

  activate(): Promise<LicenseActivateResult> {
    return activate(this.ctx);
  }

  deactivate(): Promise<void> {
    return deactivate(this.ctx);
  }

  check(): Promise<LicenseCheckResult> {
    return check(this.ctx);
  }
}

/**
 * Proto-backed license-lifecycle sub-client. Targets `/v1/licenses/activate`,
 * `/v1/licenses/check`, and `/v1/licenses/deactivate`.
 */
class LicensesSubClient {
  constructor(private readonly ctx: OperationContext) {}

  activate(request: LicensesActivateRequest): Promise<LicensesActivateResult> {
    return licensesActivate(request, this.ctx);
  }

  check(request: LicensesCheckRequest): Promise<LicensesCheckResult> {
    return licensesCheck(request, this.ctx);
  }

  deactivate(request: LicensesDeactivateRequest): Promise<LicensesDeactivateResult> {
    return licensesDeactivate(request, this.ctx);
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

  create(request: CaseCreateRequest): Promise<CaseCreateResult> {
    return casesCreate(request, this.ctx);
  }

  email(request: CaseEmailRequest): Promise<CaseEmailResult> {
    return email(request, this.ctx);
  }
}
