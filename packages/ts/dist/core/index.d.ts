/**
 * @isa-sdk/core — shared protocol primitives.
 *
 * Re-exports the crypto helpers, problem-details types, license device
 * authentication, HTTP transport, compression, and obfuscation modules
 * that ship together as a single publishable unit. Product facades
 * (@isa-sdk/zyins, @isa-sdk/proxy) depend on this package via the
 * workspace protocol during development; the publish workflow pins
 * the workspace dep to a concrete sdk/core/v* tag at publish time.
 */
export { arrayBufferToHex, base64EncodeUtf8, base64ToBytes, bytesToBase64, bytesToBase64Url, resolveFetch, resolveSubtle, systemClock, systemRandomBytes, } from "./internal/crypto.js";
export type { Clock, RandomBytes } from "./internal/crypto.js";
export { canonicalString, formatTimestamp, type SignClock, signRequest, type SignRequestHeaders, type SignRequestInput, type SignRequestResult, } from "./auth/signRequest.js";
export * from "./http/constants.js";
export * from "./http/request.js";
export { type BootstrapInput, buildBootstrapSignatureAsync } from "./internal/auth/bootstrap.js";
export * from "./license/deviceAuth.js";
export * from "./problem-details/types.js";
export * from "./transport/index.js";
export * as compression from "./compression/gzip.js";
export * as obfuscation from "./obfuscation/xor.js";
export { type AsyncStorageLike, CREDENTIAL_KEYS, type CredentialStore, fromAsyncStorage, fromLocalStorage, inMemoryCredentialStore, loadOrMintDeviceId, mintDeviceId, type SyncStorageLike, } from "./storage/index.js";
//# sourceMappingURL=index.d.ts.map