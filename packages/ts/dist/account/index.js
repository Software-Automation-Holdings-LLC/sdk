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
import { defaultTransport } from '../zyins/transport.js';
import { systemClock } from '../core/index.js';
import { lookup as brandingLookup, } from './branding.js';
import { lookup as preferencesLookup, set as preferencesSet, } from './preferences.js';
import { create as casesCreate, open as casesOpen, list as casesList, email as casesEmail, DEFAULT_CASE_VIEWER_BASE_URL, } from './cases.js';
import { enqueue as emailEnqueue, } from './email.js';
/** Top-level `isa.account.*` namespace. */
export class AccountNamespace {
    /** `isa.account.branding` — whitelabel lookup. */
    branding;
    /** `isa.account.preferences` — scoped settings document. */
    preferences;
    /** `isa.account.cases` — case CRUD + share. */
    cases;
    /** `isa.account.email` — transactional email enqueue. */
    email;
    constructor(opts) {
        const ctx = {
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
    ctx;
    constructor(ctx) {
        this.ctx = ctx;
    }
    lookup(request = {}) {
        return brandingLookup(request, this.ctx);
    }
}
/** `isa.account.preferences` facade. */
export class AccountPreferences {
    ctx;
    constructor(ctx) {
        this.ctx = ctx;
    }
    lookup(request) {
        return preferencesLookup(request, this.ctx);
    }
    set(request) {
        return preferencesSet(request, this.ctx);
    }
}
/** `isa.account.cases` facade — zero-knowledge share + recall. */
export class AccountCases {
    ctx;
    constructor(ctx) {
        this.ctx = ctx;
    }
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
    create(request) {
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
    open(link) {
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
    list() {
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
    email(request) {
        return casesEmail(request, this.ctx);
    }
}
/** `isa.account.email` facade. */
export class AccountEmail {
    ctx;
    constructor(ctx) {
        this.ctx = ctx;
    }
    enqueue(request) {
        return emailEnqueue(request, this.ctx);
    }
}
//# sourceMappingURL=index.js.map