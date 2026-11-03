/**
 * `isa.account.*` — per-license account operations.
 *
 * Wraps the five account-service endpoints (branding, preferences, cases,
 * email, reference-data) into a single typed surface. Construction is
 * lazy: the namespace stores the auth + transport + clock context once and
 * exposes one sub-facade per resource. Each method is a thin wrapper around
 * the underlying operation function so call sites do not assemble headers.
 *
 * The namespace targets the License-HMAC auth path. The legacy `zyins`
 * branding / preferences / cases / email surface is preserved for
 * back-compat and shares the same wire endpoints; `account` is the
 * forward-looking ergonomic surface and adds the missing operations
 * (`cases.open`, `cases.list`, scope-partitioned preferences).
 *
 * Reference data has consolidated onto `isa.zyins.datasets.getV3()`; the
 * deprecated `isa.account.referenceData` surface has been removed per
 * `/tmp/sdk-syntax-proposal.md` post-lock correction #3.
 */

import { type Clock, systemClock } from "../core/index.js";
import { defaultTransport, type Transport } from "../zyins/transport.js";
import { type AuthContext } from "./auth.js";
import { type BrandingDetail, type BrandingLookupRequest, lookup as brandingLookup } from "./branding.js";
import {
  type CaseCreateRequest,
  type CaseCreateResult,
  type CaseEmailRequest,
  type CaseEmailResult,
  type CaseOpenResult,
  type CaseSummary,
  create as casesCreate,
  DEFAULT_CASE_VIEWER_BASE_URL,
  email as casesEmail,
  list as casesList,
  open as casesOpen,
  type TCaseProduct,
} from "./cases.js";
import { type EmailEnqueueRequest, type EmailEnqueueResult, enqueue as emailEnqueue } from "./email.js";
import {
  lookup as preferencesLookup,
  type PreferencesLookupRequest,
  type PreferencesLookupResult,
  type PreferencesSetRequest,
  type PreferencesSetResult,
  set as preferencesSet,
} from "./preferences.js";

/** Construction options for {@link AccountNamespace}. */
export interface AccountNamespaceOptions {
  auth: AuthContext;
  baseUrl: string;
  /**
   * Viewer origin used to assemble case share links. Defaults to
   * {@link DEFAULT_CASE_VIEWER_BASE_URL}. The SDK appends `/<code>#k=<key>`;
   * any product prefix rides inside this base URL.
   */
  caseViewerBaseUrl?: string;
  /** Optional transport override; defaults to {@link defaultTransport}. */
  transport?: Transport;
  /** Optional clock override; defaults to {@link systemClock}. */
  clock?: Clock;
}

/** Shared per-operation context — assembled once and reused. */
interface OperationContext {
  auth: AuthContext;
  baseUrl: string;
  caseViewerBaseUrl: string;
  transport: Transport;
  clock: Clock;
}

/** Top-level `isa.account.*` namespace. */
export class AccountNamespace {
  /** `isa.account.branding` — whitelabel lookup. */
  public readonly branding: AccountBranding;
  /** `isa.account.preferences` — scoped settings document. */
  public readonly preferences: AccountPreferences;
  /** `isa.account.cases` — case CRUD + share. */
  public readonly cases: AccountCases;
  /** `isa.account.email` — transactional email enqueue. */
  public readonly email: AccountEmail;

  constructor(opts: AccountNamespaceOptions) {
    const ctx: OperationContext = {
      auth: opts.auth,
      baseUrl: opts.baseUrl,
      caseViewerBaseUrl: opts.caseViewerBaseUrl ?? DEFAULT_CASE_VIEWER_BASE_URL,
      transport: opts.transport ?? defaultTransport(),
      clock: opts.clock ?? systemClock,
    };
    this.branding = new AccountBranding(ctx);
    this.preferences = new AccountPreferences(ctx);
    this.cases = new AccountCases(ctx);
    this.email = new AccountEmail(ctx);
  }
}

/** `isa.account.branding` facade. */
export class AccountBranding {
  constructor(private readonly ctx: OperationContext) {}

  lookup(request: BrandingLookupRequest = {}): Promise<BrandingDetail> {
    return brandingLookup(request, this.ctx);
  }
}

/** `isa.account.preferences` facade. */
export class AccountPreferences {
  constructor(private readonly ctx: OperationContext) {}

  lookup(request: PreferencesLookupRequest): Promise<PreferencesLookupResult> {
    return preferencesLookup(request, this.ctx);
  }

  set(request: PreferencesSetRequest): Promise<PreferencesSetResult> {
    return preferencesSet(request, this.ctx);
  }
}

/** `isa.account.cases` facade — zero-knowledge share + recall. */
export class AccountCases {
  constructor(private readonly ctx: OperationContext) {}

  /**
   * Encrypt a payload and store the opaque envelope, returning the
   * fragment-keyed share link. The key never reaches the server.
   *
   * @example
   * ```ts
   * const { id, link } = await isa.account.cases.create({
   *   product: 'zyins',
   *   payload: { input: currentCaseToJSON() },
   * });
   * ```
   */
  create(request: CaseCreateRequest): Promise<CaseCreateResult> {
    return casesCreate(request, this.ctx);
  }

  /**
   * Resolve a share link and decrypt the payload client-side.
   *
   * @example
   * ```ts
   * const { product, payload } = await isa.account.cases.open(link);
   * ```
   */
  open(link: string): Promise<CaseOpenResult> {
    return casesOpen(link, this.ctx);
  }

  /**
   * List the caller's cases (metadata only; never ciphertext).
   *
   * @example
   * ```ts
   * const cases = await isa.account.cases.list();
   * ```
   */
  list(): Promise<CaseSummary[]> {
    return casesList(this.ctx);
  }

  /**
   * Email a case link to a recipient.
   *
   * @example
   * ```ts
   * await isa.account.cases.email({ caseId: id, to: 'jane.smith@example.com' });
   * ```
   */
  email(request: CaseEmailRequest): Promise<CaseEmailResult> {
    return casesEmail(request, this.ctx);
  }
}

/** `isa.account.email` facade. */
export class AccountEmail {
  constructor(private readonly ctx: OperationContext) {}

  enqueue(request: EmailEnqueueRequest): Promise<EmailEnqueueResult> {
    return emailEnqueue(request, this.ctx);
  }
}

// Re-export types for `import { type BrandingDetail } from '.../account'` style.
export type {
  BrandingDetail,
  BrandingLookupRequest,
  CaseCreateRequest,
  CaseCreateResult,
  CaseEmailRequest,
  CaseEmailResult,
  CaseOpenResult,
  CaseSummary,
  EmailEnqueueRequest,
  EmailEnqueueResult,
  PreferencesLookupRequest,
  PreferencesLookupResult,
  PreferencesSetRequest,
  PreferencesSetResult,
  TCaseProduct,
};
