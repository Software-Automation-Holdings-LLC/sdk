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

export {
  resolveSubtle,
  arrayBufferToHex,
  resolveFetch,
  base64EncodeUtf8,
  systemClock,
} from './internal/crypto';
export type { Clock } from './internal/crypto';

export * from './license/deviceAuth';
export * from './problem-details/types';
export * from './http/constants';
export * from './http/request';
export * from './transport';
export {
  canonicalString,
  formatTimestamp,
  signRequest,
  type SignClock,
  type SignRequestHeaders,
  type SignRequestInput,
  type SignRequestResult,
} from './auth/signRequest';

// Namespaced re-exports so identically-named symbols (compress / decompress
// in compression, encode / decode in obfuscation) don't collide at the
// barrel level. Callers import as `import { compression, obfuscation } from
// '@isa-sdk/core'` then call `compression.compress(...)`.
export * as compression from './compression/gzip';
export * as obfuscation from './obfuscation/xor';

export {
  type CredentialStore,
  type AsyncStorageLike,
  type SyncStorageLike,
  CREDENTIAL_KEYS,
  inMemoryCredentialStore,
  fromAsyncStorage,
  fromLocalStorage,
  loadOrMintDeviceId,
  mintDeviceId,
} from './storage';
