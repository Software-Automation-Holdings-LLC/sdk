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
export { Isa, ZyInsNamespace, RapidSignNamespace, ProxyNamespace, SESSIONS_REISSUE_PATH, type IsaOptions, type IsaFactoryOptions, type IsaAuthArgs, } from './zyins/isa';
export { AccountNamespace, AccountBranding, AccountPreferences, AccountCases, AccountEmail, type AccountNamespaceOptions, type BrandingDetail as AccountBrandingDetail, type BrandingLookupRequest as AccountBrandingLookupRequest, type PreferencesLookupRequest as AccountPreferencesLookupRequest, type PreferencesLookupResult as AccountPreferencesLookupResult, type PreferencesSetRequest as AccountPreferencesSetRequest, type PreferencesSetResult as AccountPreferencesSetResult, type CaseCreateRequest as AccountCaseCreateRequest, type CaseCreateResult as AccountCaseCreateResult, type CaseEmailRequest as AccountCaseEmailRequest, type CaseEmailResult as AccountCaseEmailResult, type CaseSummary as AccountCaseSummary, type EmailEnqueueRequest as AccountEmailEnqueueRequest, type EmailEnqueueResult as AccountEmailEnqueueResult, } from './account';
export { type IsaIdentity, type BearerIdentity, type LicenseIdentity, resolveBearerIdentity, resolveLicenseIdentity, ENV_VAR_NAMES, } from './zyins/envFactory';
export { IsaError, IsaApiError, IsaConfigError, IsaIdempotencyConflictError, IsaNotActivatedError, type IsaNotActivatedCode, } from './zyins/apiError';
export { type Envelope, type RawResponse, type RawResponseResult, } from './zyins/envelope';
export { canonicalString, formatTimestamp, signRequest, type SignClock, type SignRequestHeaders, type SignRequestInput, type SignRequestResult, } from './core/auth/signRequest';
export { Sex, NicotineUsage, NicotineDuration, Height, Weight, type Applicant, type Medication, type Condition, type NicotineUsageInput, type NicotineProductUsage, } from './zyins/applicant';
export { Coverage, QuoteType, isMulti, type CoverageInput, type CoverageType, type SingleCoverage, type MultiCoverage, type FaceValueCoverage, type MonthlyBudgetCoverage, } from './zyins/coverage';
export { ProductSelection, ProductType, Products, type Product, type ProductTypeValue, } from './zyins/product';
export { type LogosGetOptions, type LogosFetch, type LogosResponse, } from './zyins/logos';
export { Product as ProductSlug, Products as ProductSlugs, type ProductMetadata, State, States, type StateMetadata, ProductCarriers, type ProductCarrierMetadata, ConditionCategories, type ConditionCategoryMetadata, MedicationUses, type MedicationUseMetadata, Scope, ScopeDescriptions, SignEvent, SignEventLabels, ErrorCode, ErrorAdviceCodes, ErrorDocUrls, } from './catalog';
export { type DebugLogger, type EnvReader, type LogSink, debugLoggerFromEnv, makeLogger, redactHeaders, redactBody, redactBodyString, processEnv, stderrSink, } from './zyins/logger';
//# sourceMappingURL=index.d.ts.map