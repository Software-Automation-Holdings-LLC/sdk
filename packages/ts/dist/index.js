/**
 * `@software-automation-holdings-llc/sdk` — unified TypeScript SDK
 * for the ISA platform APIs.
 *
 * Single package, three sub-namespaces (`zyins`, `rapidsign`, `proxy`)
 * accessed via the {@link Isa} client. Foundational types (auth, errors,
 * envelope, transport) are re-exported flat from this barrel.
 *
 * Hello world:
 * ```ts
 * import { Isa } from '@software-automation-holdings-llc/sdk';
 * const isa = Isa.withBearer();              // reads ISA_TOKEN
 * const { data } = await isa.zyins.prequalify(req);
 * ```
 *
 * Concurrency: a single `Isa` instance carries no shared mutable state;
 * concurrent in-flight calls on one instance are safe.
 *
 * Tree-shaking: the package is annotated `sideEffects: false`. Importing
 * only the names you use keeps unused product namespaces out of your
 * bundle.
 */
// --- Unified facade ------------------------------------------------------
export { Isa, ZyInsNamespace, RapidSignNamespace, ProxyNamespace, SESSIONS_REISSUE_PATH, } from './zyins/isa';
// --- Account namespace --------------------------------------------------
export { AccountNamespace, AccountBranding, AccountPreferences, AccountCases, AccountEmail, } from './account';
// --- Auth / identity / env factory --------------------------------------
// `SessionIdentity` and `resolveSessionIdentity` are intentionally omitted
// from the public surface — sessions are SDK-internal refresh state minted
// by `Isa.withKeycode` / `Isa.forForm`, not a consumer-constructed auth
// mode (sdk-syntax-proposal.md §4 + §6).
export { resolveBearerIdentity, resolveLicenseIdentity, ENV_VAR_NAMES, } from './zyins/envFactory';
// --- Errors -------------------------------------------------------------
export { IsaError, IsaApiError, IsaConfigError, IsaIdempotencyConflictError, IsaNotActivatedError, } from './zyins/apiError';
export { canonicalString, formatTimestamp, signRequest, } from './core/auth/signRequest';
// --- Value types / domain primitives (zyins-flavored, public) ----------
export { Sex, NicotineUsage, NicotineDuration, Height, Weight, } from './zyins/applicant';
export { Coverage, QuoteType, isMulti, } from './zyins/coverage';
export { ProductSelection, ProductType, Products, } from './zyins/product';
// --- Generated catalogs -------------------------------------------------
// Every name in this block is produced by `scripts/gen-catalog.mjs`. See
// `src/catalog/` for the source modules and `docs/SDK_DESIGN.md` §5.1
// for the named-export contract.
export { 
// Legacy flat slug enum + accessor from `src/catalog/products.ts`.
// The typed Product interface and nested `Products` namespace exported
// above (from `./zyins/product`) shadow these names; consumers needing the
// legacy flat enum should import from `./catalog/products` directly.
Product as ProductSlug, Products as ProductSlugs, State, States, ProductCarriers, ConditionCategories, MedicationUses, Scope, ScopeDescriptions, SignEvent, SignEventLabels, ErrorCode, ErrorAdviceCodes, ErrorDocUrls, } from './catalog';
// --- Debug logger / env reader -----------------------------------------
export { debugLoggerFromEnv, makeLogger, redactHeaders, redactBody, redactBodyString, processEnv, stderrSink, } from './zyins/logger';
//# sourceMappingURL=index.js.map