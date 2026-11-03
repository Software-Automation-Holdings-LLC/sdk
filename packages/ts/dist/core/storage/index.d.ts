/**
 * `@isa-sdk/core/storage` — pluggable credential storage facade.
 *
 * Exports the {@link CredentialStore} interface, adapters for AsyncStorage
 * and synchronous browser `localStorage`, an in-memory default, and the
 * device-id mint+persist helpers.
 */
export { type AsyncStorageLike, CREDENTIAL_KEYS, type CredentialStore, fromAsyncStorage, fromLocalStorage, inMemoryCredentialStore, type SyncStorageLike, } from "./credentialStore.js";
export { loadOrMintDeviceId, mintDeviceId } from "./deviceId.js";
//# sourceMappingURL=index.d.ts.map