/**
 * Tier 3 ZyINS facade — public exports.
 *
 * Framework adapters (`react/useZyIns`, `vue/useZyIns`) are NOT re-exported
 * from this barrel; consumers import them from `@isa-sdk/zyins/react` or
 * `@isa-sdk/zyins/vue` so non-React / non-Vue environments do not pull a
 * framework into their bundle.
 */
export { ZyInsClient, DEFAULT_ZYINS_BASE_URL } from './client';
export { isAuthContext } from './auth';
export { Sex, NicotineUsage, NicotineDuration, Height, Weight, } from './applicant';
export { Coverage, QuoteType, isMulti, } from './coverage';
export { ProductSelection, ProductClass, ProductType, Products, } from './product';
export { ProductsFacade } from './products';
export { ZyInsError, LicenseError, PrequalifyError, RateLimitedError, fromHttpResponse, fromProblemDetails, } from './errors';
export { prequalifyV2, } from './prequalify-v2';
// --- v3 reference + pricing surface (Phase 3) -----------------------------
export { prequalifyV3, } from './prequalify-v3';
export { quoteV3, } from './quote-v3';
export { getDatasetsV3, isNotModified, buildTypoMap, buildFrequencyMap, DatasetsV3SubClient, } from './datasets-v3';
export { Sort as ReferenceSort, matchCondition, matchConcept, matchMedication, } from './reference';
export { DefaultAutocorrector, DefaultMatchAlgorithm, DefaultAutocompleteAlgorithm, buildSuggestion, } from './reference/index';
export { BearerAuth, LicenseAuth, FormAuth, RemoteEngine, LocalEngine, ProxyEngine, InMemoryEngine, inMemoryEngineWith, resolveIsaOptions, DEFAULT_TIMEOUT_MS, BundledApiVersions, resolveApiVersions, } from './isaOptions';
export { ZeroKnowledgeCaseStorage } from './cases/ZeroKnowledgeCaseStorage';
export { getReadiness, } from './health';
export { defaultTransport, } from './transport';
// --- Phase 1+2 additions (SDK_DESIGN.md §§3,4,5,6,7,10) -------------------
export { Isa, ZyInsNamespace } from './isa';
export { ReferenceFacade, ReferenceMedicationsFacade, ReferenceConditionsFacade, ReferenceConceptsFacade, } from './isaNamespaces';
export { IsaCredentialState, } from './credentialState';
export { resolveBearerIdentity, resolveLicenseIdentity, resolveSessionIdentity, ENV_VAR_NAMES, } from './envFactory';
export { IsaError, IsaApiError, IsaConfigError, IsaCaseExpiredError, IsaIdempotencyConflictError, IsaNotActivatedError, IsaTimeoutError, } from './apiError';
export { debugLoggerFromEnv, makeLogger, redactHeaders, redactBody, redactBodyString, processEnv, stderrSink, } from './logger';
//# sourceMappingURL=index.js.map