/**
 * Tier 3 ZyINS facade — public exports.
 *
 * Framework adapters (`react/useZyIns`, `vue/useZyIns`) are NOT re-exported
 * from this barrel; consumers import them from `@isa-sdk/zyins/react` or
 * `@isa-sdk/zyins/vue` so non-React / non-Vue environments do not pull a
 * framework into their bundle.
 */
export { ZyInsClient, DEFAULT_ZYINS_BASE_URL, type ZyInsClientOptions } from './client.js';
export { isAuthContext, type AuthContext } from './auth.js';
export { Sex, NicotineUsage, NicotineDuration, Height, Weight, type Applicant, type Medication, type Condition, type NicotineUsageInput, type NicotineProductUsage, } from './applicant.js';
export { Coverage, QuoteType, isMulti, type CoverageInput, type CoverageType, type SingleCoverage, type MultiCoverage, type FaceValueCoverage, type MonthlyBudgetCoverage, } from './coverage.js';
export { ProductSelection, ProductClass, ProductType, Products, type Product, type ProductClassValue, } from './product.js';
export { ProductsFacade } from './products.js';
export { ZyInsError, LicenseError, PrequalifyError, RateLimitedError, fromHttpResponse, fromProblemDetails, type LicenseErrorCode, type PrequalifyErrorCode, } from './errors.js';
export { type PrequalifyRequest, type PrequalifyResult, type PrequalifyPlan, type Plan, type PrequalifyOptions, type PrequalifyResultMeta, type SinglePrequalifyResult, type MultiPrequalifyResult, } from './prequalify.js';
export { prequalifyV2, type PrequalifyV2Request, type PrequalifyV2Result, type PrequalifyV2Options, type PrequalifyV2Context, type PlanOffer, type OtherOffer, type OfferEligibility, type OfferCategory, type OfferCarrier, type OfferProduct, type OfferPlanInfo, type OfferPlanInfoItem, type OfferPlanInfoLegacy, type OfferDeathBenefit, type OfferPremium, type OfferMoney, } from './prequalify-v2.js';
export { prequalifyV3, byAmount, offerPremium, type PrequalifyV3Request, type PrequalifyV3Result, type PrequalifyV3Options, type PrequalifyV3Context, type V3Offer, type V3Eligibility, type V3EligibilityCategory, type V3Amount, type V3Money, type V3Period, type V3Premium, type V3PricingRow, } from './prequalify-v3.js';
export { quoteV3, type QuoteV3Request, type QuoteV3Result, type QuoteV3Options, type QuoteV3Context, } from './quote-v3.js';
export { getDatasetsV3, isNotModified, buildTypoMap, buildFrequencyMap, DatasetsV3SubClient, type DatasetBundleV3, type DatasetCategory, type DatasetEntry, type DatasetsV3GetOptions, type DatasetsV3NotModified, type ReferenceEntity, type ConditionEntity, type ConditionTreatedWith, type MedicationEntity, type MedicationUsedFor, type NicotineOptionEntity, type SpellingCorrectionEntity, } from './datasets-v3.js';
export { Sort as ReferenceSort, matchCondition, matchConcept, matchMedication, type Concept, type ConceptKind, type ConditionConcept, type MedicationConcept, type UnknownConcept, } from './reference.js';
export { DefaultAutocorrector, DefaultMatchAlgorithm, DefaultAutocompleteAlgorithm, buildSuggestion, type Autocorrector, type AutocorrectOptions, type AutocorrectAppliedEvent, type DefaultAutocorrectorOptions, type MatchAlgorithm, type DefaultMatchAlgorithmOptions, type AutocompleteAlgorithm, type AutocompleteOptions, type DefaultAutocompleteAlgorithmOptions, type Suggestion, type ReferenceAdapters, } from './reference/index.js';
export { BearerAuth, LicenseAuth, FormAuth, RemoteEngine, LocalEngine, ProxyEngine, InMemoryEngine, inMemoryEngineWith, resolveIsaOptions, DEFAULT_TIMEOUT_MS, BundledApiVersions, resolveApiVersions, type IsaApiVersion, type IsaApiVersionOverride, type IsaApiSurface, type IsaAuthSupplier, type IsaEngine, type IsaCreateOptions, type ResolvedIsaOptions, } from './isaOptions.js';
export type { CaseStorage, CaseRecord, CaseStoragePutResult, } from './cases/CaseStorage.js';
export { ZeroKnowledgeCaseStorage } from './cases/ZeroKnowledgeCaseStorage.js';
export { type ClientVersionStatus, type ClientVersionListener, } from './clientVersion.js';
export { type LicenseActivateRequest, type LicenseActivateResult, type LicenseActivateAuth, type LicenseCheckRequest, type LicenseCheckResult, type LicenseDeactivateRequest, type LicenseDeactivateResult, type LicenseValidationStatus, } from './license.js';
export { getReadiness, type ReadinessResult, type ProbeResult, type ServingStatus, type HealthContext, } from './health.js';
export { type CaseEmailRequest, type CaseEmailResult, } from './case.js';
export { defaultTransport, type Transport, type TransportRequest, type TransportResponse, type HttpMethod, } from './transport.js';
export { Isa, ZyInsNamespace, type IsaOptions } from './isa.js';
export { ReferenceFacade, ReferenceMedicationsFacade, ReferenceConditionsFacade, ReferenceConceptsFacade, } from './isaNamespaces.js';
export { IsaCredentialState, type LicenseCredentialSnapshot, type LicenseRefreshedEvent, type LicenseRefreshedListener, } from './credentialState.js';
export { type IsaIdentity, type BearerIdentity, type LicenseIdentity, type SessionIdentity, resolveBearerIdentity, resolveLicenseIdentity, resolveSessionIdentity, ENV_VAR_NAMES, } from './envFactory.js';
export { IsaError, IsaApiError, IsaConfigError, IsaCaseExpiredError, IsaIdempotencyConflictError, IsaNotActivatedError, IsaTimeoutError, type IsaNotActivatedCode, } from './apiError.js';
export { type Envelope, type RawResponse, type RawResponseResult, } from './envelope.js';
export { type DebugLogger, type EnvReader, type LogSink, debugLoggerFromEnv, makeLogger, redactHeaders, redactBody, redactBodyString, processEnv, stderrSink, } from './logger.js';
//# sourceMappingURL=index.d.ts.map