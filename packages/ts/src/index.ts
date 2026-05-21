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
  ZyInsNamespace,
  RapidSignNamespace,
  ProxyNamespace,
  type IsaOptions,
  type IsaFactoryOptions,
} from './zyins/isa';

// --- Account namespace --------------------------------------------------
export {
  AccountNamespace,
  AccountBranding,
  AccountPreferences,
  AccountCases,
  AccountEmail,
  AccountReferenceData,
  type AccountNamespaceOptions,
  type BrandingDetail as AccountBrandingDetail,
  type BrandingLookupRequest as AccountBrandingLookupRequest,
  type PreferencesLookupRequest as AccountPreferencesLookupRequest,
  type PreferencesLookupResult as AccountPreferencesLookupResult,
  type PreferencesSetRequest as AccountPreferencesSetRequest,
  type PreferencesSetResult as AccountPreferencesSetResult,
  type CaseCreateRequest as AccountCaseCreateRequest,
  type CaseCreateResult as AccountCaseCreateResult,
  type CaseEmailRequest as AccountCaseEmailRequest,
  type CaseEmailResult as AccountCaseEmailResult,
  type CaseSummary as AccountCaseSummary,
  type EmailEnqueueRequest as AccountEmailEnqueueRequest,
  type EmailEnqueueResult as AccountEmailEnqueueResult,
  type ReferenceDataRequest as AccountReferenceDataRequest,
  type ReferenceDataResult as AccountReferenceDataResult,
} from './account';

// --- Auth / identity / env factory --------------------------------------
export {
  type IsaIdentity,
  type BearerIdentity,
  type LicenseIdentity,
  type SessionIdentity,
  resolveBearerIdentity,
  resolveLicenseIdentity,
  resolveSessionIdentity,
  ENV_VAR_NAMES,
} from './zyins/envFactory';

// --- Errors -------------------------------------------------------------
export {
  IsaError,
  IsaApiError,
  IsaConfigError,
  IsaIdempotencyConflictError,
} from './zyins/apiError';

// --- Envelope -----------------------------------------------------------
export {
  type Envelope,
  type RawResponse,
  type RawResponseResult,
} from './zyins/envelope';
export {
  canonicalString,
  formatTimestamp,
  signRequest,
  type SignClock,
  type SignRequestHeaders,
  type SignRequestInput,
  type SignRequestResult,
} from './core/auth/signRequest';

// --- Value types / domain primitives (zyins-flavored, public) ----------
export {
  Sex,
  NicotineUsage,
  Height,
  Weight,
  sexWireCode,
  type Applicant,
  type Medication,
  type Condition,
} from './zyins/applicant';
export {
  Coverage,
  type FaceValueCoverage,
  type MonthlyBudgetCoverage,
} from './zyins/coverage';
export {
  ProductCatalog,
  ProductSelection,
  ProductType,
  // The legacy zyins `Product` interface (brand + type + wireToken + label)
  // is re-exported as `ZyinsProduct` because the generated catalog below
  // claims the unprefixed `Product` symbol as a slug-valued string enum.
  // Existing consumers that imported `Product` for the wire-string regex
  // helpers should switch to `ZyinsProduct` or use `ProductSelection`.
  type Product as ZyinsProduct,
} from './zyins/product';

// --- Logos (public images; no auth) ------------------------------------
export {
  type LogosGetOptions,
  type LogosFetch,
  type LogosResponse,
} from './zyins/logos';

// --- Generated catalogs -------------------------------------------------
// Every name in this block is produced by `scripts/gen-catalog.mjs`. See
// `src/catalog/` for the source modules and `docs/SDK_DESIGN.md` §5.1
// for the named-export contract.
export {
  Product,
  Products,
  type ProductMetadata,
  State,
  States,
  type StateMetadata,
  ProductCarriers,
  type ProductCarrierMetadata,
  ConditionCategories,
  type ConditionCategoryMetadata,
  MedicationUses,
  type MedicationUseMetadata,
  Scope,
  ScopeDescriptions,
  SignEvent,
  SignEventLabels,
  ErrorCode,
  ErrorAdviceCodes,
  ErrorDocUrls,
} from './catalog';

// --- Debug logger / env reader -----------------------------------------
export {
  type DebugLogger,
  type EnvReader,
  type LogSink,
  debugLoggerFromEnv,
  makeLogger,
  redactHeaders,
  redactBody,
  redactBodyString,
  processEnv,
  stderrSink,
} from './zyins/logger';
