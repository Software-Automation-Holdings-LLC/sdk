/**
 * `@isa-sdk/core/storage` — pluggable credential storage facade.
 *
 * Exports the {@link CredentialStore} interface, adapters for AsyncStorage
 * and synchronous browser `localStorage`, an in-memory default, and the
 * device-id mint+persist helpers.
 */
export {
  type CredentialStore,
  type AsyncStorageLike,
  type SyncStorageLike,
  CREDENTIAL_KEYS,
  inMemoryCredentialStore,
  fromAsyncStorage,
  fromLocalStorage,
} from './credentialStore.js';

export { loadOrMintDeviceId, mintDeviceId } from './deviceId.js';
