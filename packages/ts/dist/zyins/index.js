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
export { ProductSelection, ProductType, Products, } from './product';
export { ProductsFacade } from './products';
export { ZyInsError, LicenseError, PrequalifyError, RateLimitedError, fromHttpResponse, fromProblemDetails, } from './errors';
export { getReadiness, } from './health';
export { defaultTransport, } from './transport';
// --- Phase 1+2 additions (SDK_DESIGN.md §§3,4,5,6,7,10) -------------------
export { Isa, ZyInsNamespace } from './isa';
export { IsaCredentialState, } from './credentialState';
export { resolveBearerIdentity, resolveLicenseIdentity, resolveSessionIdentity, ENV_VAR_NAMES, } from './envFactory';
export { IsaError, IsaApiError, IsaConfigError, IsaIdempotencyConflictError, IsaNotActivatedError, } from './apiError';
export { debugLoggerFromEnv, makeLogger, redactHeaders, redactBody, redactBodyString, processEnv, stderrSink, } from './logger';
//# sourceMappingURL=index.js.map