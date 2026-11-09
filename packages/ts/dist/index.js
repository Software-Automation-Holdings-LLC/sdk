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
export { Isa, ProxyNamespace, RapidSignNamespace, SESSIONS_PATH, SESSIONS_REISSUE_PATH, ZyInsNamespace, } from "./zyins/isa.js";
// --- Account namespace --------------------------------------------------
export { AccountBranding, AccountCases, AccountEmail, AccountNamespace, AccountPreferences, } from "./account/index.js";
// --- Auth / identity / env factory --------------------------------------
// `SessionIdentity` and `resolveSessionIdentity` are intentionally omitted
// from the public surface — sessions are SDK-internal refresh state minted
// by `Isa.withKeycode` / `Isa.forForm`, not a consumer-constructed auth
// mode (sdk-syntax-proposal.md §4 + §6).
export { isAuthContext } from "./zyins/auth.js";
export { ENV_VAR_NAMES, resolveBearerIdentity, resolveLicenseIdentity, } from "./zyins/envFactory.js";
// --- Errors -------------------------------------------------------------
// One hierarchy: every error descends from `IsaError`; the product and failure
// kind live in `code`, not in a parallel class tree (Stripe/AWS convention).
export { IsaApiError, IsaCaseExpiredError, IsaConfigError, IsaError, IsaIdempotencyConflictError, IsaLicenseError, IsaNotActivatedError, isApiError, IsaRateLimitError, IsaTimeoutError, IsaUnauthorizedError, IsaValidationError, isIdempotencyConflictError, isNotActivatedError, } from "./zyins/apiError.js";
// --- Case crypto (zero-knowledge envelope) ------------------------------
export { decryptCase, encryptCase, IsaCaseDecryptError, } from "./account/caseCrypto.js";
// --- Envelope -----------------------------------------------------------
export { canonicalString, formatTimestamp, signRequest, } from "./core/auth/signRequest.js";
// --- Value types / domain primitives (zyins-flavored, public) ----------
export { Height, NicotineDuration, NicotineUsage, Sex, Weight, } from "./zyins/applicant.js";
export { Coverage, isMulti, QuoteType, } from "./zyins/coverage.js";
export { MinRank } from "./zyins/minRank.js";
export { ProductClass, Products, ProductSelection, ProductType, } from "./zyins/product.js";
// --- Reference catalog (typed concepts, sort, adapters) ----------------
// `ReferenceSort` + the concept/adapter types are the surface bpp2.0 (and
// any reference consumer) imports from the package root. Re-exported here
// so `import { ReferenceSort } from '@software-automation-holdings-llc/sdk'`
// resolves without a per-consumer shim; the `./zyins` subpath in
// `package.json#exports` exposes the same names under a namespaced path.
export { ApiDatasetSource, DatasetSourceError, 
// Pluggable dataset source — load the reference bundle from a local
// file (offline `conditions.match`) instead of the API. Purely
// additive; the API path stays the default.
FileDatasetSource, 
// `FuzzyMatchAlgorithm` is the opt-in typo-tolerant matcher. The class
// (not just its type) is re-exported here so integrators can construct
// it from the package root — `new FuzzyMatchAlgorithm({ frequencies })`
// — and pass it to `Isa.withKeycode({ matchAlgorithm })`. The default
// matcher stays `DefaultMatchAlgorithm`; this is purely additive.
FuzzyMatchAlgorithm, platformFileReader, ReferenceSort, ResolvingDatasetSource, StaticDatasetSource, toDatasetSource, } from "./zyins/index.js";
// --- Prequalify v3 (request + pricing surface) -------------------------
// The v3 surface integrators import from the package root: the request type
// they construct and the result/pricing types they read.
export { formatMoney } from "./zyins/money.js";
export { byAmount, offerPremium, } from "./zyins/prequalify-v3.js";
export { ZeroKnowledgeCaseStorage } from "./zyins/cases/ZeroKnowledgeCaseStorage.js";
export { BearerAuth, BundledApiVersions, DEFAULT_TIMEOUT_MS, FormAuth, InMemoryEngine, inMemoryEngineWith, LicenseAuth, LocalEngine, ProxyEngine, RemoteEngine, resolveApiVersions, resolveIsaOptions, SessionAuth, } from "./zyins/isaOptions.js";
// --- Generated catalogs -------------------------------------------------
// Every name in this block is produced by `scripts/gen-catalog.mjs`. See
// `src/catalog/` for the source modules and `docs/SDK_DESIGN.md` §5.1
// for the named-export contract.
export { ConditionCategories, ErrorAdviceCodes, ErrorCode, ErrorDocUrls, 
// Legacy flat slug enum + accessor from `src/catalog/products.ts`.
// The typed Product interface and nested `Products` namespace exported
// above (from `./zyins/product`) shadow these names; consumers needing the
// legacy flat enum should import from `./catalog/products` directly.
Product as ProductSlug, ProductCarriers, Products as ProductSlugs, Scope, ScopeDescriptions, SignEvent, SignEventLabels, State, States, } from "./catalog/index.js";
// --- Debug logger / env reader -----------------------------------------
export { debugLoggerFromEnv, makeLogger, processEnv, redactBody, redactBodyString, redactHeaders, stderrSink, } from "./zyins/logger.js";
//# sourceMappingURL=index.js.map