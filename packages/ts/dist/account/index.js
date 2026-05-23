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
 * (`cases.get`, `cases.list`, scope-partitioned preferences).
 *
 * Reference data has consolidated onto `isa.zyins.datasets.get()`; the
 * deprecated `isa.account.referenceData` surface has been removed per
 * `/tmp/sdk-syntax-proposal.md` post-lock correction #3.
 */
import { defaultTransport } from '../zyins/transport';
import { systemClock } from '../core';
import { lookup as brandingLookup, } from './branding';
import { lookup as preferencesLookup, set as preferencesSet, } from './preferences';
import { create as casesCreate, get as casesGet, list as casesList, email as casesEmail, } from './cases';
import { enqueue as emailEnqueue, } from './email';
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
/** `isa.account.cases` facade. */
export class AccountCases {
    ctx;
    constructor(ctx) {
        this.ctx = ctx;
    }
    create(request) {
        return casesCreate(request, this.ctx);
    }
    get(caseId) {
        return casesGet(caseId, this.ctx);
    }
    list() {
        return casesList(this.ctx);
    }
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