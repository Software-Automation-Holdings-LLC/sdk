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
import { type CaseShareRequest, type CaseShareResult } from './cases';
import { type CaseEmailRequest, type CaseEmailResult } from './case';
import type { CaseRecord, CaseStorage, CaseStoragePutResult } from './cases/CaseStorage';
import { assembleLink } from '../account/caseWire';
import { type DatasetBundle, type DatasetsGetOptions } from './datasets';
import {
  type DatasetBundleV3,
  type DatasetsV3GetOptions,
  type DatasetsV3NotModified,
} from './datasets-v3';
import {
  type Concept,
  type ConditionConcept,
  type MedicationConcept,
  type UnknownConcept,
} from './reference';
export {
  ReferenceFacade,
  ReferenceMedicationsFacade,
  ReferenceConditionsFacade,
  ReferenceConceptsFacade,
  ReferenceBundleCache,
  DefaultAutocorrector,
  DefaultMatchAlgorithm,
  DefaultAutocompleteAlgorithm,
  buildSuggestion,
} from './reference/index';
export type {
  Autocorrector,
  AutocorrectOptions,
  AutocorrectAppliedEvent,
  DefaultAutocorrectorOptions,
  MatchAlgorithm,
  DefaultMatchAlgorithmOptions,
  AutocompleteAlgorithm,
  AutocompleteOptions,
  DefaultAutocompleteAlgorithmOptions,
  Suggestion,
  ReferenceAdapters,
} from './reference/index';
import {
  activate as licenseActivate,
  check as licenseCheck,
  deactivate as licenseDeactivate,
  type LicenseActivateRequest,
  type LicenseActivateResult,
  type LicenseCheckRequest,
  type LicenseCheckResult,
  type LicenseContext,
  type LicenseDeactivateRequest,
  type LicenseDeactivateResult,
} from './license';
import { type IsaCredentialState } from './credentialState';
import { type Transport } from './transport';
import { type Clock, systemClock } from '../core';
import {
  type LogosFetch,
  type LogosGetOptions,
  LogosSubClient,
} from './logos';

type ClientThunk = () => ZyInsClient;

/**
 * One-shot deprecation warning helpers. Each surface that has a singular →
 * plural (or method-rename) shim logs a `console.warn` exactly once per
 * facade instance so the noise doesn't drown a busy app.
 */
const DEPRECATED_WARNED = new WeakSet<object>();
function warnDeprecatedOnce(scope: object, message: string): void {
  if (DEPRECATED_WARNED.has(scope)) return;
  DEPRECATED_WARNED.add(scope);
  if (typeof console !== 'undefined' && typeof console.warn === 'function') {
    console.warn(`[isa-sdk] ${message}`);
  }
}

/** `isa.zyins.branding` — whitelabel lookup. */
export class BrandingFacade {
  constructor(private readonly clientOnce: ClientThunk) {}

  /** Fetch whitelabel branding for the calling license. */
  lookup(): Promise<BrandingDetail> {
    return this.clientOnce().branding.lookup();
  }
}

/**
 * `isa.zyins.datasets` — reference-data bundle for picker UIs.
 *
 * `get()` preserves the existing v2 bundle contract for callers that
 * have not migrated their downstream parsing.
 *
 * `getV3()` is the v3 endpoint (`GET /v3/datasets`) and is the canonical
 * SDK surface going forward. It returns typed `{id, name}` entities and
 * id-keyed relationship maps — consumers never re-derive keys.
 */
export class DatasetsFacade {
  /**
   * @param clientOnce  Lazy ZyInsClient accessor.
   * @param onBundle    Optional sink invoked with every fresh
   *                    `DatasetBundleV3` returned by `getV3()`. The
   *                    `ZyInsNamespace` wires this to the shared
   *                    `ReferenceBundleCache` so `isa.zyins.reference.match()`
   *                    sees the catalog without any consumer plumbing.
   */
  constructor(
    private readonly clientOnce: ClientThunk,
    private readonly onBundle?: (bundle: DatasetBundleV3) => void,
  ) {}

  /**
   * Fetch the legacy v2 reference-data bundle.
   */
  get(options?: DatasetsGetOptions): Promise<DatasetBundle> {
    return this.clientOnce().datasets.get(options);
  }

  /** Alias for `get()` retained for explicit migration call sites. */
  getLegacy(options?: DatasetsGetOptions): Promise<DatasetBundle> {
    return this.get(options);
  }

  /**
   * Fetch the v3 reference catalog. Pass `{ include }` to narrow,
   * `{ fields: 'meta' }` for the cheap names+versions check, or
   * `{ ifNoneMatch: etag }` to revalidate.
   *
   * Returns either a `DatasetBundleV3` or a `DatasetsV3NotModified`
   * marker when the server responded `304`; use `isNotModified()` to
   * discriminate.
   *
   * On a fresh-bundle response, the `onBundle` callback (if supplied) is
   * invoked synchronously before the promise resolves. The
   * `ZyInsNamespace` uses this hook to warm the reference index.
   */
  async getV3(
    options?: DatasetsV3GetOptions,
  ): Promise<DatasetBundleV3 | DatasetsV3NotModified> {
    const result = await this.clientOnce().datasetsV3.get(options);
    if (this.onBundle !== undefined && !isNotModifiedMarker(result)) {
      this.onBundle(result);
    }
    return result;
  }
}

function isNotModifiedMarker(
  result: DatasetBundleV3 | DatasetsV3NotModified,
): result is DatasetsV3NotModified {
  return (result as DatasetsV3NotModified).notModified === true;
}

// `ReferenceFacade` and its sub-facades live in `./reference/index.ts`
// and are re-exported above. The types are passed through here for
// callers that import from `isaNamespaces` directly.
export type { Concept, ConditionConcept, MedicationConcept, UnknownConcept };

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

/**
 * `isa.zyins.cases` — case share + email.
 *
 * Per the locked-spec surface (Section 3 Flow 5 + Appendix B post-lock
 * correction #2): the canonical verb is `share({ input, results?, products? })`.
 * One method, optional analysis fields. The recipient's UI
 * (`forceReadonlyAtom` in bpp2.0) decides RO vs RW display state — the SDK
 * has no `mode` flag.
 *
 * @example
 * ```ts
 * // RW link (no analysis snapshot):
 * const rw = await isa.zyins.cases.share({ input: currentCaseToJSON() });
 *
 * // RO link (analysis snapshot included):
 * const ro = await isa.zyins.cases.share({
 *   input:    currentCaseToJSON(),
 *   results:  currentAnalysisResult,
 *   products: selectedProducts,
 * });
 * ```
 */
export class CasesFacade {
  constructor(
    private readonly clientOnce: ClientThunk,
    private readonly caseStorageOnce: () => CaseStorage,
    private readonly caseViewerBaseUrlOnce: () => string,
  ) {}

  /**
   * Persist a record through the resolved {@link CaseStorage} adapter.
   * The default {@link ZeroKnowledgeCaseStorage} encrypts client-side and
   * returns the per-record key as `recallToken`; carrier adapters may
   * return a different token shape or omit it entirely. Treat the token
   * as opaque.
   *
   * @example
   * ```ts
   * const { id, recallToken } = await isa.zyins.cases.save({
   *   product: 'zyins',
   *   payload: { input: currentCaseToJSON() },
   * });
   * ```
   */
  save(record: CaseRecord): Promise<CaseStoragePutResult> {
    return this.caseStorageOnce().put(record);
  }

  /**
   * Resolve a record from the configured {@link CaseStorage} adapter.
   * `recallToken` is required iff `save()` returned one. Returns `null`
   * when the record is absent — adapters do not distinguish "expired"
   * from "never existed" by design.
   */
  recall(id: string, recallToken?: string): Promise<CaseRecord | null> {
    return this.caseStorageOnce().get(id, recallToken);
  }

  /**
   * Share an existing record by id + opaque recallToken. Built-in:
   * assembles `${caseViewerBaseUrl}/c/<id>#k=<recallToken>`. Carrier
   * adapters may not have URL semantics; in that case the recipient
   * exchanges `(id, recallToken)` through whatever channel the carrier
   * documents — the SDK has no shared URL contract for non-default
   * adapters and returns `undefined` for the link.
   *
   * Overload 2 — the legacy `share(request)` shape — persists a quote
   * snapshot and returns the assembled share link in one call. Retained
   * for back-compat; new code prefers `save()` + `share(id, token)`.
   */
  share(id: string, recallToken?: string): { id: string; recallToken: string | undefined; link: string | undefined };
  share(request: CaseShareRequest): Promise<CaseShareResult>;
  share(
    arg1: string | CaseShareRequest,
    recallToken?: string,
  ): Promise<CaseShareResult> | { id: string; recallToken: string | undefined; link: string | undefined } {
    if (typeof arg1 === 'string') {
      return assembleShareView(arg1, recallToken, this.caseViewerBaseUrlOnce());
    }
    return this.clientOnce().cases.share(arg1);
  }

  /**
   * @deprecated Use `save()` (or the legacy `share(request)` overload).
   * `create()` is a back-compat alias retained until v0.7.0.
   */
  create(request: CaseShareRequest): Promise<CaseShareResult> {
    warnDeprecatedOnce(
      this,
      'isa.zyins.cases.create is deprecated; use isa.zyins.cases.save. Removed in v0.7.0.',
    );
    return this.clientOnce().cases.share(request);
  }

  /** Email a case PDF/artifact to a recipient. */
  email(request: CaseEmailRequest): Promise<CaseEmailResult> {
    return this.clientOnce().cases.email(request);
  }
}

/**
 * Compose the recipient-visible share view from an id + opaque token.
 * Carrier adapters that surface an opaque token without URL semantics
 * leave `link` `undefined`; the caller threads `(id, recallToken)`
 * through the carrier's documented channel instead.
 */
function assembleShareView(
  id: string,
  recallToken: string | undefined,
  viewerBaseUrl: string,
): { id: string; recallToken: string | undefined; link: string | undefined } {
  if (typeof id !== 'string' || id.length === 0) {
    throw new Error('isa.zyins.cases.share requires a non-empty id');
  }
  if (recallToken === undefined || recallToken.length === 0) {
    return { id, recallToken: undefined, link: undefined };
  }
  return { id, recallToken, link: assembleLink(viewerBaseUrl, id, recallToken) };
}

/** Construction options for the credential-aware `LicenseFacade`. */
export interface LicenseFacadeOptions {
  /** Shared credential state owned by the parent `Isa`. */
  state: IsaCredentialState;
  /** Base URL for the license surface. */
  baseUrl: string;
  /** Transport facade (default fetch; tests inject a stub). */
  transport: Transport;
  /** Clock facade for HMAC timestamps. */
  clock?: Clock;
}

/**
 * `isa.zyins.license` — license lifecycle (activate / check / deactivate).
 *
 * Per the locked-spec surface (post-lock correction #3): a device has
 * exactly one license, so the namespace is singular. The wire is also
 * singular (`/v1/license/activate`).
 *
 * Every method accepts an optional partial request; missing fields fall back
 * to the credentials the parent `Isa` was constructed with. The first
 * successful `activate()` updates the shared credential state in place so
 * subsequent calls (`prequalify`, `cases.share`, …) sign with the new
 * license key automatically — no caller re-bootstrap.
 *
 * @example
 * ```ts
 * import { Isa } from '@software-automation-holdings-llc/sdk';
 * const isa = await Isa.withKeycode({
 *   keycode: 'SDV-HWH-WDD',
 *   email:   'john.doe@acme-agency.com',
 * });
 * const result = await isa.zyins.license.activate();
 * console.log(result.remainingActivations);
 * ```
 */
export class LicenseFacade {
  private readonly opts: LicenseFacadeOptions;

  constructor(opts: LicenseFacadeOptions) {
    this.opts = opts;
  }

  /**
   * Activate a license on this device. With no args, the facade fills
   * `email`, `keycode`, and `deviceId` from the parent `Isa`'s credential
   * state. Callers MAY override any field per-call.
   */
  async activate(request?: Partial<LicenseActivateRequest>): Promise<LicenseActivateResult> {
    const filled = this.fillActivate(request);
    const result = await licenseActivate(filled, this.buildContext());
    if (result.status === 'active' && isOwnLicenseRequest(this.opts.state, filled)) {
      await this.opts.state.refreshLicenseKey(result.auth.licenseKey);
    }
    return result;
  }

  /** Phone-home validation. Defaults fill from instance state. */
  async check(request?: Partial<LicenseCheckRequest>): Promise<LicenseCheckResult> {
    return licenseCheck(this.fillCheck(request), this.buildContext());
  }

  /** Deactivate this device. Clears the stashed license key on success. */
  async deactivate(
    request?: Partial<LicenseDeactivateRequest>,
  ): Promise<LicenseDeactivateResult> {
    const filled = this.fillDeactivate(request);
    const result = await licenseDeactivate(filled, this.buildContext());
    if (isOwnLicenseRequest(this.opts.state, filled)) {
      await this.opts.state.clearLicenseKey();
    }
    return result;
  }

  private buildContext(): LicenseContext {
    return {
      baseUrl: this.opts.baseUrl,
      auth: this.opts.state.auth,
      transport: this.opts.transport,
      clock: this.opts.clock ?? systemClock,
    };
  }

  private fillActivate(request: Partial<LicenseActivateRequest> | undefined): LicenseActivateRequest {
    const snap = this.opts.state.snapshot();
    return {
      email: request?.email ?? snap.email,
      keycode: request?.keycode ?? snap.keycode,
      deviceId: request?.deviceId ?? snap.deviceId,
    };
  }

  private fillCheck(request: Partial<LicenseCheckRequest> | undefined): LicenseCheckRequest {
    const snap = this.opts.state.snapshot();
    const filled: LicenseCheckRequest = {
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
    request: Partial<LicenseDeactivateRequest> | undefined,
  ): LicenseDeactivateRequest {
    const snap = this.opts.state.snapshot();
    const filled: LicenseDeactivateRequest = {
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
