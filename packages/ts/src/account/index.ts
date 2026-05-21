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
 * (`cases.get`, `cases.list`, `referenceData.get`, scope-partitioned
 * preferences).
 */

import { type AuthContext } from './auth';
import { type Transport, defaultTransport } from '../zyins/transport';
import { type Clock, systemClock } from '../core';
import {
  lookup as brandingLookup,
  type BrandingDetail,
  type BrandingLookupRequest,
} from './branding';
import {
  lookup as preferencesLookup,
  set as preferencesSet,
  type PreferencesLookupRequest,
  type PreferencesLookupResult,
  type PreferencesSetRequest,
  type PreferencesSetResult,
} from './preferences';
import {
  create as casesCreate,
  get as casesGet,
  list as casesList,
  email as casesEmail,
  type CaseCreateRequest,
  type CaseCreateResult,
  type CaseEmailRequest,
  type CaseEmailResult,
  type CaseSummary,
} from './cases';
import {
  enqueue as emailEnqueue,
  type EmailEnqueueRequest,
  type EmailEnqueueResult,
} from './email';
import {
  get as referenceDataGet,
  type ReferenceDataRequest,
  type ReferenceDataResult,
} from './referenceData';

/** Construction options for {@link AccountNamespace}. */
export interface AccountNamespaceOptions {
  auth: AuthContext;
  baseUrl: string;
  /** Optional transport override; defaults to {@link defaultTransport}. */
  transport?: Transport;
  /** Optional clock override; defaults to {@link systemClock}. */
  clock?: Clock;
}

/** Shared per-operation context — assembled once and reused. */
interface OperationContext {
  auth: AuthContext;
  baseUrl: string;
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
  /** `isa.account.referenceData` — engine reference-data lookups. */
  public readonly referenceData: AccountReferenceData;

  constructor(opts: AccountNamespaceOptions) {
    const ctx: OperationContext = {
      auth: opts.auth,
      baseUrl: opts.baseUrl,
      transport: opts.transport ?? defaultTransport(),
      clock: opts.clock ?? systemClock,
    };
    this.branding = new AccountBranding(ctx);
    this.preferences = new AccountPreferences(ctx);
    this.cases = new AccountCases(ctx);
    this.email = new AccountEmail(ctx);
    this.referenceData = new AccountReferenceData(ctx);
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

/** `isa.account.cases` facade. */
export class AccountCases {
  constructor(private readonly ctx: OperationContext) {}

  create(request: CaseCreateRequest): Promise<CaseCreateResult> {
    return casesCreate(request, this.ctx);
  }

  get(caseId: string): Promise<CaseSummary> {
    return casesGet(caseId, this.ctx);
  }

  list(): Promise<CaseSummary[]> {
    return casesList(this.ctx);
  }

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

/** `isa.account.referenceData` facade. */
export class AccountReferenceData {
  constructor(private readonly ctx: OperationContext) {}

  get(request: ReferenceDataRequest): Promise<ReferenceDataResult> {
    return referenceDataGet(request, this.ctx);
  }
}

// Re-export types for `import { type BrandingDetail } from '.../account'` style.
export type {
  BrandingDetail,
  BrandingLookupRequest,
  PreferencesLookupRequest,
  PreferencesLookupResult,
  PreferencesSetRequest,
  PreferencesSetResult,
  CaseCreateRequest,
  CaseCreateResult,
  CaseEmailRequest,
  CaseEmailResult,
  CaseSummary,
  EmailEnqueueRequest,
  EmailEnqueueResult,
  ReferenceDataRequest,
  ReferenceDataResult,
};
