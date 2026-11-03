/**
 * Tier 3 ZyINS facade — public exports.
 *
 * Framework adapters (`react/useZyIns`, `vue/useZyIns`) are NOT re-exported
 * from this barrel; consumers import them from `@isa-sdk/zyins/react` or
 * `@isa-sdk/zyins/vue` so non-React / non-Vue environments do not pull a
 * framework into their bundle.
 */
export { DEFAULT_ZYINS_BASE_URL, ZyInsClient } from "./client.js";
export { isAuthContext } from "./auth.js";
export { Height, NicotineDuration, NicotineUsage, Sex, Weight, } from "./applicant.js";
export { Coverage, isMulti, QuoteType, } from "./coverage.js";
export { ProductClass, Products, ProductSelection, ProductType, } from "./product.js";
export { MinRank } from "./minRank.js";
export { ProductsFacade } from "./products.js";
export { fromHttpResponse, fromProblemDetails } from "./errors.js";
export { prequalifyV2, } from "./prequalify-v2.js";
// --- v3 reference + pricing surface (Phase 3) -----------------------------
export { buildFrequencyMap, buildTypoMap, DatasetsV3SubClient, getDatasetsV3, isNotModified, parseEnvelope, } from "./datasets-v3.js";
export { ApiDatasetSource, DatasetSourceError, FileDatasetSource, platformFileReader, ResolvingDatasetSource, StaticDatasetSource, toDatasetSource, } from "./datasetSource.js";
export { formatMoney } from "./money.js";
export { byAmount, offerPremium, prequalifyV3, } from "./prequalify-v3.js";
export { quoteV3, } from "./quote-v3.js";
export { matchConcept, matchCondition, matchMedication, Sort as ReferenceSort, } from "./reference.js";
export { buildSuggestion, DefaultAutocompleteAlgorithm, DefaultAutocorrector, DefaultMatchAlgorithm, FuzzyMatchAlgorithm, } from "./reference/index.js";
export { ZeroKnowledgeCaseStorage } from "./cases/ZeroKnowledgeCaseStorage.js";
export { BearerAuth, BundledApiVersions, DEFAULT_TIMEOUT_MS, FormAuth, InMemoryEngine, inMemoryEngineWith, LicenseAuth, LocalEngine, ProxyEngine, RemoteEngine, resolveApiVersions, resolveIsaOptions, } from "./isaOptions.js";
export { getReadiness, } from "./health.js";
export { defaultTransport, } from "./transport.js";
// --- Phase 1+2 additions (SDK_DESIGN.md §§3,4,5,6,7,10) -------------------
export { IsaApiError, IsaCaseExpiredError, IsaConfigError, IsaError, IsaIdempotencyConflictError, IsaLicenseError, IsaNotActivatedError, isApiError, IsaRateLimitError, IsaTimeoutError, IsaUnauthorizedError, IsaValidationError, isIdempotencyConflictError, isNotActivatedError, } from "./apiError.js";
export { IsaCredentialState, } from "./credentialState.js";
export { ENV_VAR_NAMES, resolveBearerIdentity, resolveLicenseIdentity, resolveSessionIdentity, } from "./envFactory.js";
export { Isa, ZyInsNamespace } from "./isa.js";
export { ReferenceConceptsFacade, ReferenceConditionsFacade, ReferenceFacade, ReferenceMedicationsFacade, } from "./isaNamespaces.js";
export { debugLoggerFromEnv, makeLogger, processEnv, redactBody, redactBodyString, redactHeaders, stderrSink, } from "./logger.js";
//# sourceMappingURL=index.js.map