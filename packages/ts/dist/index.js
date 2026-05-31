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
export { Isa, ZyInsNamespace, RapidSignNamespace, ProxyNamespace, SESSIONS_REISSUE_PATH } from './zyins/isa.js';
// --- Account namespace --------------------------------------------------
export { AccountNamespace, AccountBranding, AccountPreferences, AccountCases, AccountEmail, } from './account/index.js';
// --- Auth / identity / env factory --------------------------------------
// `SessionIdentity` and `resolveSessionIdentity` are intentionally omitted
// from the public surface — sessions are SDK-internal refresh state minted
// by `Isa.withKeycode` / `Isa.forForm`, not a consumer-constructed auth
// mode (sdk-syntax-proposal.md §4 + §6).
export { resolveBearerIdentity, resolveLicenseIdentity, ENV_VAR_NAMES } from './zyins/envFactory.js';
// --- Errors -------------------------------------------------------------
export { IsaError, IsaApiError, IsaConfigError, IsaCaseExpiredError, IsaIdempotencyConflictError, IsaNotActivatedError, IsaTimeoutError } from './zyins/apiError.js';
// --- Case crypto (zero-knowledge envelope) ------------------------------
export { encryptCase, decryptCase, IsaCaseDecryptError } from './account/caseCrypto.js';
export { canonicalString, formatTimestamp, signRequest } from './core/auth/signRequest.js';
// --- Value types / domain primitives (zyins-flavored, public) ----------
export { Sex, NicotineUsage, NicotineDuration, Height, Weight } from './zyins/applicant.js';
export { Coverage, QuoteType, isMulti } from './zyins/coverage.js';
export { ProductSelection, ProductClass, ProductType, Products } from './zyins/product.js';
// --- Reference catalog (typed concepts, sort, adapters) ----------------
// `ReferenceSort` + the concept/adapter types are the surface bpp2.0 (and
// any reference consumer) imports from the package root. Re-exported here
// so `import { ReferenceSort } from '@software-automation-holdings-llc/sdk'`
// resolves without a per-consumer shim; the `./zyins` subpath in
// `package.json#exports` exposes the same names under a namespaced path.
export { ReferenceSort, } from './zyins/index.js';
// --- IsaOptions sugar constructor -------------------------------------
export { BearerAuth, LicenseAuth, FormAuth, RemoteEngine, LocalEngine, ProxyEngine, InMemoryEngine, inMemoryEngineWith, resolveIsaOptions, DEFAULT_TIMEOUT_MS, BundledApiVersions, resolveApiVersions, } from './zyins/isaOptions.js';
export { ZeroKnowledgeCaseStorage } from './zyins/cases/ZeroKnowledgeCaseStorage.js';
// --- Generated catalogs -------------------------------------------------
// Every name in this block is produced by `scripts/gen-catalog.mjs`. See
// `src/catalog/` for the source modules and `docs/SDK_DESIGN.md` §5.1
// for the named-export contract.
export { 
// Legacy flat slug enum + accessor from `src/catalog/products.ts`.
// The typed Product interface and nested `Products` namespace exported
// above (from `./zyins/product`) shadow these names; consumers needing the
// legacy flat enum should import from `./catalog/products` directly.
Product as ProductSlug, Products as ProductSlugs, State, States, ProductCarriers, ConditionCategories, MedicationUses, Scope, ScopeDescriptions, SignEvent, SignEventLabels, ErrorCode, ErrorAdviceCodes, ErrorDocUrls, } from './catalog/index.js';
// --- Debug logger / env reader -----------------------------------------
export { debugLoggerFromEnv, makeLogger, redactHeaders, redactBody, redactBodyString, processEnv, stderrSink } from './zyins/logger.js';
//# sourceMappingURL=index.js.map