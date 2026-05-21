/**
 * @isa-sdk/proxy — internal transport package.
 *
 * Algosure HMAC signing primitives and the proxy-call wiring that
 * product facades (@isa-sdk/zyins, @isa-sdk/rapidsign) compose with.
 * Application code should NOT import from this package directly; it
 * imports the product facade, which has @isa-sdk/proxy as a transitive
 * dependency (ADR-035 "Proxy is internal-facing").
 */

export * from "./algosure";
export * from "./transport/call";
export {
  type ProxyCallBinding,
  type ProxyCallOptions,
  type ProxyCallResult,
  assertSessionIdentityForProxyCall,
  proxyCall as proxyCallV2,
} from "./call";
