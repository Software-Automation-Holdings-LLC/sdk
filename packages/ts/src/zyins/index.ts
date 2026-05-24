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
  type FaceValueCoverage,
  type MonthlyBudgetCoverage,
} from './coverage';

export {
  ProductCatalog,
  ProductSelection,
  ProductType,
  type Product,
  type RawProductEntry,
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
} from './prequalify';

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
  IsaIdempotencyConflictError,
  IsaNotActivatedError,
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
