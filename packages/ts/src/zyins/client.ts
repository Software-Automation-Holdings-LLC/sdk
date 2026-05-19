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
import { prequalify, type PrequalifyRequest, type PrequalifyResult } from './prequalify';
import {
  activate,
  deactivate,
  check,
  type LicenseActivateResult,
  type LicenseCheckResult,
} from './license';
import { email, type CaseEmailRequest, type CaseEmailResult } from './case';

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

  public readonly license: LicenseSubClient;
  public readonly case: CaseSubClient;

  constructor(options: ZyInsClientOptions) {
    this.auth = options.auth;
    this.baseUrl = options.baseUrl ?? DEFAULT_ZYINS_BASE_URL;
    this.transport = options.transport ?? defaultTransport();
    this.clock = options.clock ?? systemClock;
    this.license = new LicenseSubClient(this.context());
    this.case = new CaseSubClient(this.context());
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

/** Sub-client exposing license activation / deactivation / check. */
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

/** Sub-client exposing case-level operations (email, future: pdf, send). */
class CaseSubClient {
  constructor(private readonly ctx: OperationContext) {}

  email(request: CaseEmailRequest): Promise<CaseEmailResult> {
    return email(request, this.ctx);
  }
}
