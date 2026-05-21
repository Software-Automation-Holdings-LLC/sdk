/**
 * Sub-namespace facades exposed via `Isa.zyins.*`. Each facade delegates
 * to the underlying Tier-3 `ZyInsClient` sub-client, lazily constructed by
 * a `() => ZyInsClient` thunk so namespace construction stays cheap.
 *
 * Separated from `isa.ts` to keep that file under the 250-line cap; this
 * module owns only the facade shape, not the unified `Isa` class itself.
 */

import { type ZyInsClient } from './client';
import { type BrandingDetail } from './branding';
import {
  type PreferencesLookupResult,
  type PreferencesSetRequest,
  type PreferencesSetResult,
} from './preferences';
import { type CaseCreateRequest, type CaseCreateResult } from './cases';
import { type CaseEmailRequest, type CaseEmailResult } from './case';
import {
  activate as licensesActivate,
  check as licensesCheck,
  deactivate as licensesDeactivate,
  type LicensesActivateRequest,
  type LicensesActivateResult,
  type LicensesCheckRequest,
  type LicensesCheckResult,
  type LicensesContext,
  type LicensesDeactivateRequest,
  type LicensesDeactivateResult,
} from './licenses';
import { type IsaCredentialState } from './credentialState';
import { type Transport } from './transport';
import { type Clock, systemClock } from '../core';
import {
  type LogosFetch,
  type LogosGetOptions,
  LogosSubClient,
} from './logos';

type ClientThunk = () => ZyInsClient;

/** `isa.zyins.branding` — whitelabel lookup. */
export class BrandingFacade {
  constructor(private readonly clientOnce: ClientThunk) {}

  /** Fetch whitelabel branding for the calling license. */
  lookup(): Promise<BrandingDetail> {
    return this.clientOnce().branding.lookup();
  }
}

/** `isa.zyins.preferences` — opaque per-license preferences document. */
export class PreferencesFacade {
  constructor(private readonly clientOnce: ClientThunk) {}

  lookup(): Promise<PreferencesLookupResult> {
    return this.clientOnce().preferences.lookup();
  }

  set(request: PreferencesSetRequest): Promise<PreferencesSetResult> {
    return this.clientOnce().preferences.set(request);
  }
}

/** `isa.zyins.cases` — case create + share. */
export class CasesFacade {
  constructor(private readonly clientOnce: ClientThunk) {}

  /** Create a shareable case from quote input + results + products. */
  create(request: CaseCreateRequest): Promise<CaseCreateResult> {
    return this.clientOnce().cases.create(request);
  }

  /** Email a case PDF/artifact to a recipient. */
  email(request: CaseEmailRequest): Promise<CaseEmailResult> {
    return this.clientOnce().cases.email(request);
  }
}

/** Construction options for the credential-aware `LicensesFacade`. */
export interface LicensesFacadeOptions {
  /** Shared credential state owned by the parent `Isa`. */
  state: IsaCredentialState;
  /** Base URL for the licenses surface. */
  baseUrl: string;
  /** Transport facade (default fetch; tests inject a stub). */
  transport: Transport;
  /** Clock facade for HMAC timestamps. */
  clock?: Clock;
}

/**
 * `isa.zyins.licenses` — license lifecycle (activate / check / deactivate).
 *
 * Every method accepts an optional partial request; missing fields fall back
 * to the credentials the parent `Isa` was constructed with. The first
 * successful `activate()` updates the shared credential state in place so
 * subsequent calls (`prequalify`, `cases.create`, …) sign with the new
 * license key automatically — no caller re-bootstrap.
 */
export class LicensesFacade {
  private readonly opts: LicensesFacadeOptions;

  constructor(opts: LicensesFacadeOptions) {
    this.opts = opts;
  }

  /**
   * Activate a license on this device. With no args, the facade fills
   * `email`, `keycode`, and `deviceId` from the parent `Isa`'s credential
   * state. Callers MAY override any field per-call.
   */
  async activate(request?: Partial<LicensesActivateRequest>): Promise<LicensesActivateResult> {
    const filled = this.fillActivate(request);
    const result = await licensesActivate(filled, this.buildContext());
    if (result.status === 'active' && isOwnLicenseRequest(this.opts.state, filled)) {
      await this.opts.state.refreshLicenseKey(result.auth.licenseKey);
    }
    return result;
  }

  /** Phone-home validation. Defaults fill from instance state. */
  async check(request?: Partial<LicensesCheckRequest>): Promise<LicensesCheckResult> {
    return licensesCheck(this.fillCheck(request), this.buildContext());
  }

  /** Deactivate this device. Clears the stashed license key on success. */
  async deactivate(
    request?: Partial<LicensesDeactivateRequest>,
  ): Promise<LicensesDeactivateResult> {
    const filled = this.fillDeactivate(request);
    const result = await licensesDeactivate(filled, this.buildContext());
    if (isOwnLicenseRequest(this.opts.state, filled)) {
      await this.opts.state.clearLicenseKey();
    }
    return result;
  }

  private buildContext(): LicensesContext {
    return {
      baseUrl: this.opts.baseUrl,
      auth: this.opts.state.auth,
      transport: this.opts.transport,
      clock: this.opts.clock ?? systemClock,
    };
  }

  private fillActivate(request: Partial<LicensesActivateRequest> | undefined): LicensesActivateRequest {
    const snap = this.opts.state.snapshot();
    return {
      email: request?.email ?? snap.email,
      keycode: request?.keycode ?? snap.keycode,
      deviceId: request?.deviceId ?? snap.deviceId,
    };
  }

  private fillCheck(request: Partial<LicensesCheckRequest> | undefined): LicensesCheckRequest {
    const snap = this.opts.state.snapshot();
    const filled: LicensesCheckRequest = {
      email: request?.email ?? snap.email,
      keycode: request?.keycode ?? snap.keycode,
    };
    const deviceId = request?.deviceId ?? snap.deviceId;
    if (deviceId) filled.deviceId = deviceId;
    const licenseKey = request?.licenseKey ?? snap.licenseKey;
    if (licenseKey) filled.licenseKey = licenseKey;
    return filled;
  }

  private fillDeactivate(
    request: Partial<LicensesDeactivateRequest> | undefined,
  ): LicensesDeactivateRequest {
    const snap = this.opts.state.snapshot();
    const filled: LicensesDeactivateRequest = {
      email: request?.email ?? snap.email,
      keycode: request?.keycode ?? snap.keycode,
    };
    const deviceId = request?.deviceId ?? snap.deviceId;
    if (deviceId) filled.deviceId = deviceId;
    return filled;
  }
}

function isOwnLicenseRequest(
  state: IsaCredentialState,
  request: { email: string; keycode: string; deviceId?: string },
): boolean {
  const snap = state.snapshot();
  return (
    request.email === snap.email &&
    request.keycode === snap.keycode &&
    request.deviceId === snap.deviceId
  );
}

/**
 * `isa.zyins.email` — transactional email enqueue. Today the server
 * exposes only `POST /v1/email/enqueue`; the SDK surfaces it as
 * `email.enqueue` so future `email.list` / `email.get` operations land
 * without churn.
 */
export class EmailFacade {
  constructor(private readonly clientOnce: ClientThunk) {}

  enqueue(request: CaseEmailRequest): Promise<CaseEmailResult> {
    return this.clientOnce().cases.email(request);
  }
}

/**
 * `isa.zyins.logos` — carrier-logo asset lookup. The endpoint is on the
 * public-image GET allowlist (no auth headers), so this facade does NOT
 * route through the auth-bound `ZyInsClient`; it talks to the logos
 * sub-client directly via a base-URL + fetcher pair.
 */
export class LogosFacade {
  private readonly client: LogosSubClient;

  constructor(baseUrl: string, fetchImpl: LogosFetch | undefined) {
    this.client = new LogosSubClient(baseUrl, fetchImpl);
  }

  /**
   * Fetch the carrier-logo asset. With `dataUri: true` the promise resolves
   * to a `data:image/...` string; otherwise it resolves to a `Blob` of the
   * raw image bytes.
   */
  get(carrier: string, opts: LogosGetOptions & { dataUri: true }): Promise<string>;
  get(carrier: string, opts?: LogosGetOptions & { dataUri?: false | undefined }): Promise<Blob>;
  get(carrier: string, opts?: LogosGetOptions): Promise<Blob | string>;
  get(carrier: string, opts?: LogosGetOptions): Promise<Blob | string> {
    return this.client.get(carrier, opts);
  }
}
