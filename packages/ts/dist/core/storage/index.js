/**
 * `@isa-sdk/core/storage` — pluggable credential storage facade.
 *
 * Exports the {@link CredentialStore} interface, adapters for AsyncStorage
 * and synchronous browser `localStorage`, an in-memory default, and the
 * device-id mint+persist helpers.
 */
export { CREDENTIAL_KEYS, inMemoryCredentialStore, fromAsyncStorage, fromLocalStorage, } from './credentialStore';
export { loadOrMintDeviceId, mintDeviceId } from './deviceId';
//# sourceMappingURL=index.js.map