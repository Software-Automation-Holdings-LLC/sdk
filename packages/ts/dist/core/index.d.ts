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
export { resolveSubtle, arrayBufferToHex, resolveFetch, base64EncodeUtf8, base64ToBytes, bytesToBase64, bytesToBase64Url, systemRandomBytes, systemClock, } from './internal/crypto.js';
export type { Clock, RandomBytes } from './internal/crypto.js';
export * from './license/deviceAuth.js';
export * from './problem-details/types.js';
export * from './http/constants.js';
export * from './http/request.js';
export * from './transport/index.js';
export { canonicalString, formatTimestamp, signRequest, type SignClock, type SignRequestHeaders, type SignRequestInput, type SignRequestResult, } from './auth/signRequest.js';
export * as compression from './compression/gzip.js';
export * as obfuscation from './obfuscation/xor.js';
export { type CredentialStore, type AsyncStorageLike, type SyncStorageLike, CREDENTIAL_KEYS, inMemoryCredentialStore, fromAsyncStorage, fromLocalStorage, loadOrMintDeviceId, mintDeviceId, } from './storage/index.js';
//# sourceMappingURL=index.d.ts.map