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
import { type AuthContext } from './auth';
import { type Transport } from '../zyins/transport';
import { type Clock } from '../core';
import { type BrandingDetail, type BrandingLookupRequest } from './branding';
import { type PreferencesLookupRequest, type PreferencesLookupResult, type PreferencesSetRequest, type PreferencesSetResult } from './preferences';
import { type CaseCreateRequest, type CaseCreateResult, type CaseOpenResult, type CaseEmailRequest, type CaseEmailResult, type CaseSummary, type TCaseProduct } from './cases';
import { type EmailEnqueueRequest, type EmailEnqueueResult } from './email';
/** Construction options for {@link AccountNamespace}. */
export interface AccountNamespaceOptions {
    auth: AuthContext;
    baseUrl: string;
    /**
     * Viewer origin used to assemble case share links. Defaults to
     * {@link DEFAULT_CASE_VIEWER_BASE_URL}. The SDK appends `/c/<id>#k=<key>`;
     * the base must NOT include the `/c/` segment.
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
export declare class AccountNamespace {
    /** `isa.account.branding` — whitelabel lookup. */
    readonly branding: AccountBranding;
    /** `isa.account.preferences` — scoped settings document. */
    readonly preferences: AccountPreferences;
    /** `isa.account.cases` — case CRUD + share. */
    readonly cases: AccountCases;
    /** `isa.account.email` — transactional email enqueue. */
    readonly email: AccountEmail;
    constructor(opts: AccountNamespaceOptions);
}
/** `isa.account.branding` facade. */
export declare class AccountBranding {
    private readonly ctx;
    constructor(ctx: OperationContext);
    lookup(request?: BrandingLookupRequest): Promise<BrandingDetail>;
}
/** `isa.account.preferences` facade. */
export declare class AccountPreferences {
    private readonly ctx;
    constructor(ctx: OperationContext);
    lookup(request: PreferencesLookupRequest): Promise<PreferencesLookupResult>;
    set(request: PreferencesSetRequest): Promise<PreferencesSetResult>;
}
/** `isa.account.cases` facade — zero-knowledge share + recall. */
export declare class AccountCases {
    private readonly ctx;
    constructor(ctx: OperationContext);
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
    create(request: CaseCreateRequest): Promise<CaseCreateResult>;
    /**
     * Resolve a share link and decrypt the payload client-side.
     *
     * @example
     * ```ts
     * const { product, payload } = await isa.account.cases.open(link);
     * ```
     */
    open(link: string): Promise<CaseOpenResult>;
    /**
     * List the caller's cases (metadata only; never ciphertext).
     *
     * @example
     * ```ts
     * const cases = await isa.account.cases.list();
     * ```
     */
    list(): Promise<CaseSummary[]>;
    /**
     * Email a case link to a recipient.
     *
     * @example
     * ```ts
     * await isa.account.cases.email({ caseId: id, to: 'jane.smith@example.com' });
     * ```
     */
    email(request: CaseEmailRequest): Promise<CaseEmailResult>;
}
/** `isa.account.email` facade. */
export declare class AccountEmail {
    private readonly ctx;
    constructor(ctx: OperationContext);
    enqueue(request: EmailEnqueueRequest): Promise<EmailEnqueueResult>;
}
export type { BrandingDetail, BrandingLookupRequest, PreferencesLookupRequest, PreferencesLookupResult, PreferencesSetRequest, PreferencesSetResult, CaseCreateRequest, CaseCreateResult, CaseOpenResult, CaseEmailRequest, CaseEmailResult, CaseSummary, TCaseProduct, EmailEnqueueRequest, EmailEnqueueResult, };
//# sourceMappingURL=index.d.ts.map