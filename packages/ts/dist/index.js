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
// --- Unified facade ------------------------------------------------------
export { Isa, ZyInsNamespace, RapidSignNamespace, ProxyNamespace } from './zyins/isa';
// --- Auth / identity / env factory --------------------------------------
export { resolveBearerIdentity, resolveLicenseIdentity, resolveSessionIdentity, ENV_VAR_NAMES, } from './zyins/envFactory';
// --- Errors -------------------------------------------------------------
export { IsaError, IsaApiError, IsaConfigError, IsaIdempotencyConflictError, } from './zyins/apiError';
// --- Value types / domain primitives (zyins-flavored, public) ----------
export { Sex, NicotineUsage, Height, Weight, sexWireCode, } from './zyins/applicant';
export { Coverage, } from './zyins/coverage';
export { ProductCatalog, ProductSelection, ProductType, } from './zyins/product';
// --- Debug logger / env reader -----------------------------------------
export { debugLoggerFromEnv, makeLogger, redactHeaders, redactBody, redactBodyString, processEnv, stderrSink, } from './zyins/logger';
//# sourceMappingURL=index.js.map