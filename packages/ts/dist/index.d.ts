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
export { Isa, ZyInsNamespace, RapidSignNamespace, ProxyNamespace, SESSIONS_REISSUE_PATH, type IsaOptions, type IsaFactoryOptions, type IsaAuthArgs } from './zyins/isa';
export { AccountNamespace, AccountBranding, AccountPreferences, AccountCases, AccountEmail, type AccountNamespaceOptions, type BrandingDetail as AccountBrandingDetail, type BrandingLookupRequest as AccountBrandingLookupRequest, type PreferencesLookupRequest as AccountPreferencesLookupRequest, type PreferencesLookupResult as AccountPreferencesLookupResult, type PreferencesSetRequest as AccountPreferencesSetRequest, type PreferencesSetResult as AccountPreferencesSetResult, type CaseCreateRequest as AccountCaseCreateRequest, type CaseCreateResult as AccountCaseCreateResult, type CaseOpenResult as AccountCaseOpenResult, type CaseEmailRequest as AccountCaseEmailRequest, type CaseEmailResult as AccountCaseEmailResult, type CaseSummary as AccountCaseSummary, type TCaseProduct, type EmailEnqueueRequest as AccountEmailEnqueueRequest, type EmailEnqueueResult as AccountEmailEnqueueResult, } from './account';
export { type IsaIdentity, type BearerIdentity, type LicenseIdentity, resolveBearerIdentity, resolveLicenseIdentity, ENV_VAR_NAMES } from './zyins/envFactory';
export { IsaError, IsaApiError, IsaConfigError, IsaCaseExpiredError, IsaIdempotencyConflictError, IsaNotActivatedError, IsaTimeoutError, type IsaNotActivatedCode } from './zyins/apiError';
export { encryptCase, decryptCase, IsaCaseDecryptError, type TCaseEnvelope, type TEncryptedCase, type TCaseCryptoOptions } from './account/caseCrypto';
export { type Envelope, type RawResponse, type RawResponseResult } from './zyins/envelope';
export { canonicalString, formatTimestamp, signRequest, type SignClock, type SignRequestHeaders, type SignRequestInput, type SignRequestResult } from './core/auth/signRequest';
export { Sex, NicotineUsage, NicotineDuration, Height, Weight, type Applicant, type Medication, type Condition, type NicotineUsageInput, type NicotineProductUsage } from './zyins/applicant';
export { Coverage, QuoteType, isMulti, type CoverageInput, type CoverageType, type SingleCoverage, type MultiCoverage, type FaceValueCoverage, type MonthlyBudgetCoverage } from './zyins/coverage';
export { ProductSelection, ProductClass, ProductType, Products, type Product, type ProductClassValue } from './zyins/product';
export { ReferenceSort, type DatasetBundleV3, type DatasetCategory, type DatasetEntry, type ReferenceEntity, type ConditionEntity, type ConditionTreatedWith, type MedicationEntity, type MedicationUsedFor, type NicotineOptionEntity, type SpellingCorrectionEntity, type Concept, type ConceptKind, type ConditionConcept, type MedicationConcept, type UnknownConcept, type Suggestion, type Autocorrector, type AutocorrectOptions, type MatchAlgorithm, type AutocompleteAlgorithm, type AutocompleteOptions, type ReferenceAdapters, } from './zyins';
export { type PrequalifyV2Request, type PrequalifyV2Result, type PrequalifyV2Options, type PlanOffer, type OtherOffer, type OfferEligibility, type OfferCategory, type OfferCarrier, type OfferProduct, type OfferPlanInfo, type OfferPlanInfoItem, type OfferPlanInfoLegacy, type OfferDeathBenefit, type OfferPremium, type OfferMoney, } from './zyins/prequalify-v2';
export { BearerAuth, LicenseAuth, FormAuth, RemoteEngine, LocalEngine, ProxyEngine, InMemoryEngine, inMemoryEngineWith, resolveIsaOptions, DEFAULT_TIMEOUT_MS, BundledApiVersions, resolveApiVersions, type IsaApiVersion, type IsaApiVersionOverride, type IsaApiSurface, type IsaAuthSupplier, type IsaEngine, type IsaCreateOptions, type ResolvedIsaOptions, } from './zyins/isaOptions';
export type { CaseStorage, CaseRecord, CaseStoragePutResult } from './zyins/cases/CaseStorage';
export { ZeroKnowledgeCaseStorage } from './zyins/cases/ZeroKnowledgeCaseStorage';
export { type LogosGetOptions, type LogosFetch, type LogosResponse } from './zyins/logos';
export { Product as ProductSlug, Products as ProductSlugs, type ProductMetadata, State, States, type StateMetadata, ProductCarriers, type ProductCarrierMetadata, ConditionCategories, type ConditionCategoryMetadata, MedicationUses, type MedicationUseMetadata, Scope, ScopeDescriptions, SignEvent, SignEventLabels, ErrorCode, ErrorAdviceCodes, ErrorDocUrls, } from './catalog';
export { type DebugLogger, type EnvReader, type LogSink, debugLoggerFromEnv, makeLogger, redactHeaders, redactBody, redactBodyString, processEnv, stderrSink } from './zyins/logger';
//# sourceMappingURL=index.d.ts.map