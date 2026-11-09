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
export {
  Isa,
  type IsaAuthArgs,
  type IsaFactoryOptions,
  type IsaOptions,
  ProxyNamespace,
  RapidSignNamespace,
  SESSIONS_PATH,
  SESSIONS_REISSUE_PATH,
  ZyInsNamespace,
} from "./zyins/isa.js";

// --- Account namespace --------------------------------------------------
export {
  AccountBranding,
  AccountCases,
  AccountEmail,
  AccountNamespace,
  type AccountNamespaceOptions,
  AccountPreferences,
  type BrandingDetail as AccountBrandingDetail,
  type BrandingLookupRequest as AccountBrandingLookupRequest,
  type CaseCreateRequest as AccountCaseCreateRequest,
  type CaseCreateResult as AccountCaseCreateResult,
  type CaseEmailRequest as AccountCaseEmailRequest,
  type CaseEmailResult as AccountCaseEmailResult,
  type CaseOpenResult as AccountCaseOpenResult,
  type CaseSummary as AccountCaseSummary,
  type EmailEnqueueRequest as AccountEmailEnqueueRequest,
  type EmailEnqueueResult as AccountEmailEnqueueResult,
  type PreferencesLookupRequest as AccountPreferencesLookupRequest,
  type PreferencesLookupResult as AccountPreferencesLookupResult,
  type PreferencesSetRequest as AccountPreferencesSetRequest,
  type PreferencesSetResult as AccountPreferencesSetResult,
  type TCaseProduct,
} from "./account/index.js";

// --- Auth / identity / env factory --------------------------------------
// `SessionIdentity` and `resolveSessionIdentity` are intentionally omitted
// from the public surface — sessions are SDK-internal refresh state minted
// by `Isa.withKeycode` / `Isa.forForm`, not a consumer-constructed auth
// mode (sdk-syntax-proposal.md §4 + §6).
export { type AuthContext, isAuthContext } from "./zyins/auth.js";
export {
  type BearerIdentity,
  ENV_VAR_NAMES,
  type IsaIdentity,
  type LicenseIdentity,
  resolveBearerIdentity,
  resolveLicenseIdentity,
} from "./zyins/envFactory.js";

// --- Errors -------------------------------------------------------------
// One hierarchy: every error descends from `IsaError`; the product and failure
// kind live in `code`, not in a parallel class tree (Stripe/AWS convention).
export {
  IsaApiError,
  IsaCaseExpiredError,
  IsaConfigError,
  IsaError,
  IsaIdempotencyConflictError,
  IsaLicenseError,
  type IsaLicenseErrorCode,
  type IsaNotActivatedCode,
  IsaNotActivatedError,
  isApiError,
  IsaRateLimitError,
  IsaTimeoutError,
  IsaUnauthorizedError,
  IsaValidationError,
  isIdempotencyConflictError,
  isNotActivatedError,
} from "./zyins/apiError.js";

// --- Case crypto (zero-knowledge envelope) ------------------------------
export {
  decryptCase,
  encryptCase,
  IsaCaseDecryptError,
  type TCaseCryptoOptions,
  type TCaseEnvelope,
  type TEncryptedCase,
} from "./account/caseCrypto.js";

// --- Envelope -----------------------------------------------------------
export {
  canonicalString,
  formatTimestamp,
  type SignClock,
  signRequest,
  type SignRequestHeaders,
  type SignRequestInput,
  type SignRequestResult,
} from "./core/auth/signRequest.js";
export { type Envelope, type RawResponse, type RawResponseResult } from "./zyins/envelope.js";

// --- Value types / domain primitives (zyins-flavored, public) ----------
export {
  type Applicant,
  type Condition,
  Height,
  type Medication,
  NicotineDuration,
  type NicotineProductUsage,
  NicotineUsage,
  type NicotineUsageInput,
  Sex,
  Weight,
} from "./zyins/applicant.js";
export {
  Coverage,
  type CoverageInput,
  type CoverageType,
  type FaceValueCoverage,
  isMulti,
  type MonthlyBudgetCoverage,
  type MultiCoverage,
  QuoteType,
  type SingleCoverage,
} from "./zyins/coverage.js";
export { MinRank, type MinRankValue } from "./zyins/minRank.js";
export {
  type Product,
  ProductClass,
  type ProductClassValue,
  Products,
  ProductSelection,
  ProductType,
} from "./zyins/product.js";

// --- Reference catalog (typed concepts, sort, adapters) ----------------
// `ReferenceSort` + the concept/adapter types are the surface bpp2.0 (and
// any reference consumer) imports from the package root. Re-exported here
// so `import { ReferenceSort } from '@software-automation-holdings-llc/sdk'`
// resolves without a per-consumer shim; the `./zyins` subpath in
// `package.json#exports` exposes the same names under a namespaced path.
export {
  ApiDatasetSource,
  type AutocompleteAlgorithm,
  type AutocompleteOptions,
  type AutocorrectOptions,
  type Autocorrector,
  type Concept,
  type ConceptKind,
  type ConditionConcept,
  type ConditionEntity,
  type ConditionTreatedWith,
  type DatasetBundleV3,
  type DatasetCategory,
  type DatasetEntry,
  type DatasetSource,
  DatasetSourceError,
  type DatasetSourceInput,
  // Pluggable dataset source — load the reference bundle from a local
  // file (offline `conditions.match`) instead of the API. Purely
  // additive; the API path stays the default.
  FileDatasetSource,
  type FileReader,
  // `FuzzyMatchAlgorithm` is the opt-in typo-tolerant matcher. The class
  // (not just its type) is re-exported here so integrators can construct
  // it from the package root — `new FuzzyMatchAlgorithm({ frequencies })`
  // — and pass it to `Isa.withKeycode({ matchAlgorithm })`. The default
  // matcher stays `DefaultMatchAlgorithm`; this is purely additive.
  FuzzyMatchAlgorithm,
  type FuzzyMatchAlgorithmOptions,
  type MatchAlgorithm,
  type MedicationConcept,
  type MedicationEntity,
  type MedicationUsedFor,
  type NicotineOptionEntity,
  type OnMissingHook,
  platformFileReader,
  type ReferenceAdapters,
  type ReferenceEntity,
  ReferenceSort,
  ResolvingDatasetSource,
  type SpellingCorrectionEntity,
  StaticDatasetSource,
  type Suggestion,
  toDatasetSource,
  type UnknownConcept,
} from "./zyins/index.js";

// --- Prequalify v2 (typed offer surface) -------------------------------
export {
  type OfferCarrier,
  type OfferCategory,
  type OfferDeathBenefit,
  type OfferEligibility,
  type OfferMoney,
  type OfferPlanInfo,
  type OfferPlanInfoItem,
  type OfferPlanInfoLegacy,
  type OfferPremium,
  type OfferProduct,
  type OtherOffer,
  type PlanOffer,
  type PrequalifyV2Options,
  type PrequalifyV2Request,
  type PrequalifyV2Result,
} from "./zyins/prequalify-v2.js";

// --- Prequalify (canonical, de-versioned) ------------------------------
// The unversioned surface integrators import from the package root. The SDK
// routes these to the active /vN internally; the call site never changes.
export {
  type MultiPrequalifyResult,
  type Plan,
  type PrequalifyOptions,
  type PrequalifyPlan,
  type PrequalifyRequest,
  type PrequalifyResult,
  type PrequalifyResultMeta,
  type SinglePrequalifyResult,
} from "./zyins/prequalify.js";

// --- Prequalify v3 (request + pricing surface) -------------------------
// The v3 surface integrators import from the package root: the request type
// they construct and the result/pricing types they read.
export { formatMoney, type FormatMoneyOptions } from "./zyins/money.js";
export {
  byAmount,
  offerPremium,
  type PrequalifyV3Options,
  type PrequalifyV3Request,
  type PrequalifyV3Result,
  type V3Amount,
  type V3Eligibility,
  type V3EligibilityCategory,
  type V3Money,
  type V3Offer,
  type V3Period,
  type V3Premium,
  type V3PricingRow,
} from "./zyins/prequalify-v3.js";

// --- IsaOptions sugar constructor -------------------------------------
export type { CaseRecord, CaseStorage, CaseStoragePutResult } from "./zyins/cases/CaseStorage.js";
export { ZeroKnowledgeCaseStorage } from "./zyins/cases/ZeroKnowledgeCaseStorage.js";
export {
  BearerAuth,
  BundledApiVersions,
  DEFAULT_TIMEOUT_MS,
  FormAuth,
  InMemoryEngine,
  inMemoryEngineWith,
  type IsaApiSurface,
  type IsaApiVersion,
  type IsaApiVersionOverride,
  type IsaAuthSupplier,
  type IsaCreateOptions,
  type IsaEngine,
  LicenseAuth,
  LocalEngine,
  ProxyEngine,
  RemoteEngine,
  resolveApiVersions,
  type ResolvedIsaOptions,
  resolveIsaOptions,
  SessionAuth,
} from "./zyins/isaOptions.js";

// --- Logos (public images; no auth) ------------------------------------
export { type LogosFetch, type LogosGetOptions, type LogosResponse } from "./zyins/logos.js";

// --- Generated catalogs -------------------------------------------------
// Every name in this block is produced by `scripts/gen-catalog.mjs`. See
// `src/catalog/` for the source modules and `docs/SDK_DESIGN.md` §5.1
// for the named-export contract.
export {
  ConditionCategories,
  type ConditionCategoryMetadata,
  ErrorAdviceCodes,
  ErrorCode,
  ErrorDocUrls,
  // Legacy flat slug enum + accessor from `src/catalog/products.ts`.
  // The typed Product interface and nested `Products` namespace exported
  // above (from `./zyins/product`) shadow these names; consumers needing the
  // legacy flat enum should import from `./catalog/products` directly.
  Product as ProductSlug,
  type ProductCarrierMetadata,
  ProductCarriers,
  type ProductMetadata,
  Products as ProductSlugs,
  Scope,
  ScopeDescriptions,
  SignEvent,
  SignEventLabels,
  State,
  type StateMetadata,
  States,
} from "./catalog/index.js";

// --- Debug logger / env reader -----------------------------------------
export {
  type DebugLogger,
  debugLoggerFromEnv,
  type EnvReader,
  type LogSink,
  makeLogger,
  processEnv,
  redactBody,
  redactBodyString,
  redactHeaders,
  stderrSink,
} from "./zyins/logger.js";
