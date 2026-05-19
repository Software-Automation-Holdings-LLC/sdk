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
export { Isa, ZyInsNamespace, RapidSignNamespace, ProxyNamespace, type IsaOptions } from './zyins/isa';
export { type IsaIdentity, type BearerIdentity, type LicenseIdentity, type SessionIdentity, resolveBearerIdentity, resolveLicenseIdentity, resolveSessionIdentity, ENV_VAR_NAMES, } from './zyins/envFactory';
export { IsaError, IsaApiError, IsaConfigError, IsaIdempotencyConflictError, } from './zyins/apiError';
export { type Envelope, type RawResponse, type RawResponseResult, } from './zyins/envelope';
export { Sex, NicotineUsage, Height, Weight, sexWireCode, type Applicant, type Medication, type Condition, } from './zyins/applicant';
export { Coverage, type FaceValueCoverage, type MonthlyBudgetCoverage, } from './zyins/coverage';
export { ProductCatalog, ProductSelection, ProductType, type Product, } from './zyins/product';
export { type DebugLogger, type EnvReader, type LogSink, debugLoggerFromEnv, makeLogger, redactHeaders, redactBody, redactBodyString, processEnv, stderrSink, } from './zyins/logger';
//# sourceMappingURL=index.d.ts.map