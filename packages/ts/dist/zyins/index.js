/**
 * Tier 3 ZyINS facade — public exports.
 *
 * Framework adapters (`react/useZyIns`, `vue/useZyIns`) are NOT re-exported
 * from this barrel; consumers import them from `@isa-sdk/zyins/react` or
 * `@isa-sdk/zyins/vue` so non-React / non-Vue environments do not pull a
 * framework into their bundle.
 */
export { ZyInsClient, DEFAULT_ZYINS_BASE_URL } from './client.js';
export { isAuthContext } from './auth.js';
export { Sex, NicotineUsage, NicotineDuration, Height, Weight, } from './applicant.js';
export { Coverage, QuoteType, isMulti, } from './coverage.js';
export { ProductSelection, ProductClass, ProductType, Products, } from './product.js';
export { ProductsFacade } from './products.js';
export { ZyInsError, LicenseError, PrequalifyError, RateLimitedError, fromHttpResponse, fromProblemDetails, } from './errors.js';
export { prequalifyV2, } from './prequalify-v2.js';
// --- v3 reference + pricing surface (Phase 3) -----------------------------
export { prequalifyV3, byAmount, offerPremium, } from './prequalify-v3.js';
export { quoteV3, } from './quote-v3.js';
export { getDatasetsV3, isNotModified, buildTypoMap, buildFrequencyMap, DatasetsV3SubClient, } from './datasets-v3.js';
export { Sort as ReferenceSort, matchCondition, matchConcept, matchMedication, } from './reference.js';
export { DefaultAutocorrector, DefaultMatchAlgorithm, DefaultAutocompleteAlgorithm, buildSuggestion, } from './reference/index.js';
export { BearerAuth, LicenseAuth, FormAuth, RemoteEngine, LocalEngine, ProxyEngine, InMemoryEngine, inMemoryEngineWith, resolveIsaOptions, DEFAULT_TIMEOUT_MS, BundledApiVersions, resolveApiVersions, } from './isaOptions.js';
export { ZeroKnowledgeCaseStorage } from './cases/ZeroKnowledgeCaseStorage.js';
export { getReadiness, } from './health.js';
export { defaultTransport, } from './transport.js';
// --- Phase 1+2 additions (SDK_DESIGN.md §§3,4,5,6,7,10) -------------------
export { Isa, ZyInsNamespace } from './isa.js';
export { ReferenceFacade, ReferenceMedicationsFacade, ReferenceConditionsFacade, ReferenceConceptsFacade, } from './isaNamespaces.js';
export { IsaCredentialState, } from './credentialState.js';
export { resolveBearerIdentity, resolveLicenseIdentity, resolveSessionIdentity, ENV_VAR_NAMES, } from './envFactory.js';
export { IsaError, IsaApiError, IsaConfigError, IsaCaseExpiredError, IsaIdempotencyConflictError, IsaNotActivatedError, IsaTimeoutError, } from './apiError.js';
export { debugLoggerFromEnv, makeLogger, redactHeaders, redactBody, redactBodyString, processEnv, stderrSink, } from './logger.js';
//# sourceMappingURL=index.js.map