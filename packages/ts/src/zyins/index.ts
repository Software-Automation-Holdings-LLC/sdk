/**
 * Tier 3 ZyINS facade — public exports.
 *
 * Framework adapters (`react/useZyIns`, `vue/useZyIns`) are NOT re-exported
 * from this barrel; consumers import them from `@isa-sdk/zyins/react` or
 * `@isa-sdk/zyins/vue` so non-React / non-Vue environments do not pull a
 * framework into their bundle.
 */

export { ZyInsClient, DEFAULT_ZYINS_BASE_URL, type ZyInsClientOptions } from './client';

export { isAuthContext, type AuthContext } from './auth';

export {
  Sex,
  NicotineUsage,
  NicotineDuration,
  Height,
  Weight,
  type Applicant,
  type Medication,
  type Condition,
  type NicotineUsageInput,
  type NicotineProductUsage,
} from './applicant';

export {
  Coverage,
  QuoteType,
  isMulti,
  type CoverageInput,
  type CoverageType,
  type SingleCoverage,
  type MultiCoverage,
  type FaceValueCoverage,
  type MonthlyBudgetCoverage,
} from './coverage';

export {
  ProductSelection,
  ProductClass,
  ProductType,
  Products,
  type Product,
  type ProductClassValue,
} from './product';

export { ProductsFacade } from './products';

export {
  ZyInsError,
  LicenseError,
  PrequalifyError,
  RateLimitedError,
  fromHttpResponse,
  fromProblemDetails,
  type LicenseErrorCode,
  type PrequalifyErrorCode,
} from './errors';

export {
  type PrequalifyRequest,
  type PrequalifyResult,
  type PrequalifyPlan,
  type Plan,
  type PrequalifyOptions,
  type PrequalifyResultMeta,
  type SinglePrequalifyResult,
  type MultiPrequalifyResult,
} from './prequalify';

export {
  prequalifyV2,
  type PrequalifyV2Request,
  type PrequalifyV2Result,
  type PrequalifyV2Options,
  type PrequalifyV2Context,
  type PlanOffer,
  type OtherOffer,
  type OfferEligibility,
  type OfferCategory,
  type OfferCarrier,
  type OfferProduct,
  type OfferPlanInfo,
  type OfferPlanInfoItem,
  type OfferPlanInfoLegacy,
  type OfferDeathBenefit,
  type OfferPremium,
  type OfferMoney,
} from './prequalify-v2';

// --- v3 reference + pricing surface (Phase 3) -----------------------------
export {
  prequalifyV3,
  type PrequalifyV3Request,
  type PrequalifyV3Result,
  type PrequalifyV3Options,
  type PrequalifyV3Context,
  type PrequalifyV3Offer,
  type V3Eligibility,
  type V3EligibilityCategory,
  type V3Money,
  type V3Premium,
  type V3PricingRow,
  type V3DeathBenefit,
} from './prequalify-v3';
export {
  quoteV3,
  type QuoteV3Request,
  type QuoteV3Result,
  type QuoteV3Options,
  type QuoteV3Context,
  type QuoteV3Group,
  type QuoteV3Product,
} from './quote-v3';
export {
  getDatasetsV3,
  isNotModified,
  buildTypoMap,
  buildFrequencyMap,
  DatasetsV3SubClient,
  type DatasetBundleV3,
  type DatasetCategory,
  type DatasetEntry,
  type DatasetsV3GetOptions,
  type DatasetsV3NotModified,
  type ReferenceEntity,
  type ConditionEntity,
  type ConditionTreatedWith,
  type MedicationEntity,
  type MedicationUsedFor,
  type NicotineOptionEntity,
  type SpellingCorrectionEntity,
} from './datasets-v3';
export {
  Sort as ReferenceSort,
  matchCondition,
  matchConcept,
  matchMedication,
  type Concept,
  type ConceptKind,
  type ConditionConcept,
  type MedicationConcept,
  type UnknownConcept,
} from './reference';
export {
  DefaultAutocorrector,
  DefaultMatchAlgorithm,
  DefaultAutocompleteAlgorithm,
  buildSuggestion,
  type Autocorrector,
  type AutocorrectOptions,
  type AutocorrectAppliedEvent,
  type DefaultAutocorrectorOptions,
  type MatchAlgorithm,
  type DefaultMatchAlgorithmOptions,
  type AutocompleteAlgorithm,
  type AutocompleteOptions,
  type DefaultAutocompleteAlgorithmOptions,
  type Suggestion,
  type ReferenceAdapters,
} from './reference/index';

export {
  BearerAuth,
  LicenseAuth,
  FormAuth,
  RemoteEngine,
  LocalEngine,
  ProxyEngine,
  InMemoryEngine,
  inMemoryEngineWith,
  resolveIsaOptions,
  DEFAULT_TIMEOUT_MS,
  BundledApiVersions,
  resolveApiVersions,
  type IsaApiVersion,
  type IsaApiVersionOverride,
  type IsaApiSurface,
  type IsaAuthSupplier,
  type IsaEngine,
  type IsaCreateOptions,
  type ResolvedIsaOptions,
} from './isaOptions';
export type {
  CaseStorage,
  CaseRecord,
  CaseStoragePutResult,
} from './cases/CaseStorage';
export { ZeroKnowledgeCaseStorage } from './cases/ZeroKnowledgeCaseStorage';

export {
  type ClientVersionStatus,
  type ClientVersionListener,
} from './clientVersion';

export {
  type LicenseActivateRequest,
  type LicenseActivateResult,
  type LicenseActivateAuth,
  type LicenseCheckRequest,
  type LicenseCheckResult,
  type LicenseDeactivateRequest,
  type LicenseDeactivateResult,
  type LicenseValidationStatus,
} from './license';

export {
  getReadiness,
  type ReadinessResult,
  type ProbeResult,
  type ServingStatus,
  type HealthContext,
} from './health';

export {
  type CaseEmailRequest,
  type CaseEmailResult,
} from './case';

export {
  defaultTransport,
  type Transport,
  type TransportRequest,
  type TransportResponse,
  type HttpMethod,
} from './transport';

// --- Phase 1+2 additions (SDK_DESIGN.md §§3,4,5,6,7,10) -------------------
export { Isa, ZyInsNamespace, type IsaOptions } from './isa';
export {
  ReferenceFacade,
  ReferenceMedicationsFacade,
  ReferenceConditionsFacade,
  ReferenceConceptsFacade,
} from './isaNamespaces';
export {
  IsaCredentialState,
  type LicenseCredentialSnapshot,
  type LicenseRefreshedEvent,
  type LicenseRefreshedListener,
} from './credentialState';
export {
  type IsaIdentity,
  type BearerIdentity,
  type LicenseIdentity,
  type SessionIdentity,
  resolveBearerIdentity,
  resolveLicenseIdentity,
  resolveSessionIdentity,
  ENV_VAR_NAMES,
} from './envFactory';
export {
  IsaError,
  IsaApiError,
  IsaConfigError,
  IsaCaseExpiredError,
  IsaIdempotencyConflictError,
  IsaNotActivatedError,
  IsaTimeoutError,
  type IsaNotActivatedCode,
} from './apiError';
export {
  type Envelope,
  type RawResponse,
  type RawResponseResult,
} from './envelope';
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
} from './logger';
