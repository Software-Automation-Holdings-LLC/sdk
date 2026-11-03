/**
 * Tier 3 ZyINS facade — public exports.
 *
 * Framework adapters (`react/useZyIns`, `vue/useZyIns`) are NOT re-exported
 * from this barrel; consumers import them from `@isa-sdk/zyins/react` or
 * `@isa-sdk/zyins/vue` so non-React / non-Vue environments do not pull a
 * framework into their bundle.
 */

export { DEFAULT_ZYINS_BASE_URL, ZyInsClient, type ZyInsClientOptions } from "./client.js";

export { type AuthContext, isAuthContext } from "./auth.js";

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
} from "./applicant.js";

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
} from "./coverage.js";

export {
  type Product,
  ProductClass,
  type ProductClassValue,
  Products,
  ProductSelection,
  ProductType,
} from "./product.js";

export { MinRank, type MinRankValue } from "./minRank.js";

export { ProductsFacade } from "./products.js";

export { fromHttpResponse, fromProblemDetails } from "./errors.js";

export {
  type MultiPrequalifyResult,
  type Plan,
  type PrequalifyOptions,
  type PrequalifyPlan,
  type PrequalifyRequest,
  type PrequalifyResult,
  type PrequalifyResultMeta,
  type SinglePrequalifyResult,
} from "./prequalify.js";

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
  prequalifyV2,
  type PrequalifyV2Context,
  type PrequalifyV2Options,
  type PrequalifyV2Request,
  type PrequalifyV2Result,
} from "./prequalify-v2.js";

// --- v3 reference + pricing surface (Phase 3) -----------------------------
export {
  buildFrequencyMap,
  buildTypoMap,
  type ConditionEntity,
  type ConditionTreatedWith,
  type DatasetBundleV3,
  type DatasetCategory,
  type DatasetEntry,
  type DatasetsV3GetOptions,
  type DatasetsV3NotModified,
  DatasetsV3SubClient,
  getDatasetsV3,
  isNotModified,
  type MedicationEntity,
  type MedicationUsedFor,
  type NicotineOptionEntity,
  parseEnvelope,
  type ReferenceEntity,
  type SpellingCorrectionEntity,
} from "./datasets-v3.js";
export {
  ApiDatasetSource,
  type DatasetSource,
  DatasetSourceError,
  type DatasetSourceInput,
  FileDatasetSource,
  type FileReader,
  type OnMissingHook,
  platformFileReader,
  ResolvingDatasetSource,
  StaticDatasetSource,
  toDatasetSource,
} from "./datasetSource.js";
export { formatMoney, type FormatMoneyOptions } from "./money.js";
export {
  byAmount,
  offerPremium,
  prequalifyV3,
  type PrequalifyV3Context,
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
} from "./prequalify-v3.js";
export {
  quoteV3,
  type QuoteV3Context,
  type QuoteV3Options,
  type QuoteV3Request,
  type QuoteV3Result,
} from "./quote-v3.js";
export {
  type Concept,
  type ConceptKind,
  type ConditionConcept,
  matchConcept,
  matchCondition,
  matchMedication,
  type MedicationConcept,
  Sort as ReferenceSort,
  type UnknownConcept,
} from "./reference.js";
export {
  type AutocompleteAlgorithm,
  type AutocompleteOptions,
  type AutocorrectAppliedEvent,
  type AutocorrectOptions,
  type Autocorrector,
  buildSuggestion,
  DefaultAutocompleteAlgorithm,
  type DefaultAutocompleteAlgorithmOptions,
  DefaultAutocorrector,
  type DefaultAutocorrectorOptions,
  DefaultMatchAlgorithm,
  type DefaultMatchAlgorithmOptions,
  FuzzyMatchAlgorithm,
  type FuzzyMatchAlgorithmOptions,
  type MatchAlgorithm,
  type ReferenceAdapters,
  type Suggestion,
} from "./reference/index.js";

export type { CaseRecord, CaseStorage, CaseStoragePutResult } from "./cases/CaseStorage.js";
export { ZeroKnowledgeCaseStorage } from "./cases/ZeroKnowledgeCaseStorage.js";
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
} from "./isaOptions.js";

export { type ClientVersionListener, type ClientVersionStatus } from "./clientVersion.js";

export {
  type LicenseActivateAuth,
  type LicenseActivateRequest,
  type LicenseActivateResult,
  type LicenseCheckRequest,
  type LicenseCheckResult,
  type LicenseDeactivateRequest,
  type LicenseDeactivateResult,
  type LicenseValidationStatus,
} from "./license.js";

export {
  getReadiness,
  type HealthContext,
  type ProbeResult,
  type ReadinessResult,
  type ServingStatus,
} from "./health.js";

export { type CaseEmailRequest, type CaseEmailResult } from "./case.js";

export {
  defaultTransport,
  type HttpMethod,
  type Transport,
  type TransportRequest,
  type TransportResponse,
} from "./transport.js";

// --- Phase 1+2 additions (SDK_DESIGN.md §§3,4,5,6,7,10) -------------------
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
} from "./apiError.js";
export {
  IsaCredentialState,
  type LicenseCredentialSnapshot,
  type LicenseRefreshedEvent,
  type LicenseRefreshedListener,
} from "./credentialState.js";
export { type Envelope, type RawResponse, type RawResponseResult } from "./envelope.js";
export {
  type BearerIdentity,
  ENV_VAR_NAMES,
  type IsaIdentity,
  type LicenseIdentity,
  resolveBearerIdentity,
  resolveLicenseIdentity,
  resolveSessionIdentity,
  type SessionIdentity,
} from "./envFactory.js";
export { Isa, type IsaOptions, ZyInsNamespace } from "./isa.js";
export {
  ReferenceConceptsFacade,
  ReferenceConditionsFacade,
  ReferenceFacade,
  ReferenceMedicationsFacade,
} from "./isaNamespaces.js";
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
} from "./logger.js";
