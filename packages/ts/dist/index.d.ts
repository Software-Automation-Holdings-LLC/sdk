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
export { Isa, type IsaAuthArgs, type IsaFactoryOptions, type IsaOptions, ProxyNamespace, RapidSignNamespace, SESSIONS_PATH, SESSIONS_REISSUE_PATH, ZyInsNamespace, } from "./zyins/isa.js";
export { AccountBranding, AccountCases, AccountEmail, AccountNamespace, type AccountNamespaceOptions, AccountPreferences, type BrandingDetail as AccountBrandingDetail, type BrandingLookupRequest as AccountBrandingLookupRequest, type CaseCreateRequest as AccountCaseCreateRequest, type CaseCreateResult as AccountCaseCreateResult, type CaseEmailRequest as AccountCaseEmailRequest, type CaseEmailResult as AccountCaseEmailResult, type CaseOpenResult as AccountCaseOpenResult, type CaseSummary as AccountCaseSummary, type EmailEnqueueRequest as AccountEmailEnqueueRequest, type EmailEnqueueResult as AccountEmailEnqueueResult, type PreferencesLookupRequest as AccountPreferencesLookupRequest, type PreferencesLookupResult as AccountPreferencesLookupResult, type PreferencesSetRequest as AccountPreferencesSetRequest, type PreferencesSetResult as AccountPreferencesSetResult, type TCaseProduct, } from "./account/index.js";
export { type AuthContext, isAuthContext } from "./zyins/auth.js";
export { type BearerIdentity, ENV_VAR_NAMES, type IsaIdentity, type LicenseIdentity, resolveBearerIdentity, resolveLicenseIdentity, } from "./zyins/envFactory.js";
export { IsaApiError, IsaCaseExpiredError, IsaConfigError, IsaError, IsaIdempotencyConflictError, IsaLicenseError, type IsaLicenseErrorCode, type IsaNotActivatedCode, IsaNotActivatedError, isApiError, IsaRateLimitError, IsaTimeoutError, IsaUnauthorizedError, IsaValidationError, isIdempotencyConflictError, isNotActivatedError, } from "./zyins/apiError.js";
export { decryptCase, encryptCase, IsaCaseDecryptError, type TCaseCryptoOptions, type TCaseEnvelope, type TEncryptedCase, } from "./account/caseCrypto.js";
export { canonicalString, formatTimestamp, type SignClock, signRequest, type SignRequestHeaders, type SignRequestInput, type SignRequestResult, } from "./core/auth/signRequest.js";
export { type Envelope, type RawResponse, type RawResponseResult } from "./zyins/envelope.js";
export { type Applicant, type Condition, Height, type Medication, NicotineDuration, type NicotineProductUsage, NicotineUsage, type NicotineUsageInput, Sex, Weight, } from "./zyins/applicant.js";
export { Coverage, type CoverageInput, type CoverageType, type FaceValueCoverage, isMulti, type MonthlyBudgetCoverage, type MultiCoverage, QuoteType, type SingleCoverage, } from "./zyins/coverage.js";
export { MinRank, type MinRankValue } from "./zyins/minRank.js";
export { type Product, ProductClass, type ProductClassValue, Products, ProductSelection, ProductType, } from "./zyins/product.js";
export { ApiDatasetSource, type AutocompleteAlgorithm, type AutocompleteOptions, type AutocorrectOptions, type Autocorrector, type Concept, type ConceptKind, type ConditionConcept, type ConditionEntity, type ConditionTreatedWith, type DatasetBundleV3, type DatasetCategory, type DatasetEntry, type DatasetSource, DatasetSourceError, type DatasetSourceInput, FileDatasetSource, type FileReader, FuzzyMatchAlgorithm, type FuzzyMatchAlgorithmOptions, type MatchAlgorithm, type MedicationConcept, type MedicationEntity, type MedicationUsedFor, type NicotineOptionEntity, type OnMissingHook, platformFileReader, type ReferenceAdapters, type ReferenceEntity, ReferenceSort, ResolvingDatasetSource, type SpellingCorrectionEntity, StaticDatasetSource, type Suggestion, toDatasetSource, type UnknownConcept, } from "./zyins/index.js";
export { type OfferCarrier, type OfferCategory, type OfferDeathBenefit, type OfferEligibility, type OfferMoney, type OfferPlanInfo, type OfferPlanInfoItem, type OfferPlanInfoLegacy, type OfferPremium, type OfferProduct, type OtherOffer, type PlanOffer, type PrequalifyV2Options, type PrequalifyV2Request, type PrequalifyV2Result, } from "./zyins/prequalify-v2.js";
export { type MultiPrequalifyResult, type Plan, type PrequalifyOptions, type PrequalifyPlan, type PrequalifyRequest, type PrequalifyResult, type PrequalifyResultMeta, type SinglePrequalifyResult, } from "./zyins/prequalify.js";
export { formatMoney, type FormatMoneyOptions } from "./zyins/money.js";
export { byAmount, offerPremium, type PrequalifyV3Options, type PrequalifyV3Request, type PrequalifyV3Result, type V3Amount, type V3Eligibility, type V3EligibilityCategory, type V3Money, type V3Offer, type V3Period, type V3Premium, type V3PricingRow, } from "./zyins/prequalify-v3.js";
export type { CaseRecord, CaseStorage, CaseStoragePutResult } from "./zyins/cases/CaseStorage.js";
export { ZeroKnowledgeCaseStorage } from "./zyins/cases/ZeroKnowledgeCaseStorage.js";
export { BearerAuth, BundledApiVersions, DEFAULT_TIMEOUT_MS, FormAuth, InMemoryEngine, inMemoryEngineWith, type IsaApiSurface, type IsaApiVersion, type IsaApiVersionOverride, type IsaAuthSupplier, type IsaCreateOptions, type IsaEngine, LicenseAuth, LocalEngine, ProxyEngine, RemoteEngine, resolveApiVersions, type ResolvedIsaOptions, resolveIsaOptions, SessionAuth, } from "./zyins/isaOptions.js";
export { type LogosFetch, type LogosGetOptions, type LogosResponse } from "./zyins/logos.js";
export { ConditionCategories, type ConditionCategoryMetadata, ErrorAdviceCodes, ErrorCode, ErrorDocUrls, Product as ProductSlug, type ProductCarrierMetadata, ProductCarriers, type ProductMetadata, Products as ProductSlugs, Scope, ScopeDescriptions, SignEvent, SignEventLabels, State, type StateMetadata, States, } from "./catalog/index.js";
export { type DebugLogger, debugLoggerFromEnv, type EnvReader, type LogSink, makeLogger, processEnv, redactBody, redactBodyString, redactHeaders, stderrSink, } from "./zyins/logger.js";
//# sourceMappingURL=index.d.ts.map