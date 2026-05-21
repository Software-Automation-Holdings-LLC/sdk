/**
 * Pluggable credential storage facade.
 *
 * The SDK persists the device id minted at first activation and the license
 * key issued by `/v1/licenses/activate` so subsequent process boots do not
 * have to re-bootstrap the user. The storage layer is a facade so the same
 * `Isa.withLicense({...})` call works in three runtimes:
 *
 * 1. React Native — caller passes an AsyncStorage-shaped adapter.
 * 2. Browser     — caller passes a localStorage-shaped adapter.
 * 3. Node        — the SDK ships an in-memory default; a Node fs adapter
 *                  can be supplied where persistence across process boots
 *                  is required.
 *
 * The interface is intentionally tiny (get / set / remove) so any KV-shaped
 * storage can be adapted in a few lines. All values are strings; callers
 * MUST NOT pass JSON to `set` — the SDK serializes once via the key naming
 * convention defined in `CREDENTIAL_KEYS`.
 *
 * Operations may be sync or async; the facade always returns Promises.
 */

/** Persistent key/value store for SDK credentials. */
export interface CredentialStore {
  /** Read a value by key. Returns `undefined` when absent. */
  get(key: string): Promise<string | undefined>;
  /** Write a value. Overwrites any prior value. */
  set(key: string, value: string): Promise<void>;
  /** Remove a value. No-op if absent. */
  remove(key: string): Promise<void>;
}

/** Canonical key names the SDK uses inside any {@link CredentialStore}. */
export const CREDENTIAL_KEYS = {
  /** Per-device identifier; HMAC signing key for `X-Device-Signature`. */
  deviceId: 'isa.deviceId',
  /** License key minted at `/v1/licenses/activate`. */
  licenseKey: 'isa.licenseKey',
} as const;

/**
 * In-memory {@link CredentialStore}. Default when the caller supplies no
 * persistent adapter. State survives the process but NOT a restart — for
 * cross-boot persistence, plug in an AsyncStorage / localStorage / fs
 * adapter via `Isa.withLicense({ credentialStore: ... })`.
 */
export function inMemoryCredentialStore(): CredentialStore {
  const state = new Map<string, string>();
  return {
    async get(key) {
      return state.get(key);
    },
    async set(key, value) {
      state.set(key, value);
    },
    async remove(key) {
      state.delete(key);
    },
  };
}

/**
 * Adapt an AsyncStorage-shaped object (React Native, MMKV, expo-secure-store)
 * into a {@link CredentialStore}. The duck-typed interface matches both
 * `@react-native-async-storage/async-storage` and `localStorage` (after
 * wrapping in async — see {@link fromLocalStorage}).
 */
export interface AsyncStorageLike {
  getItem(key: string): Promise<string | null> | string | null;
  setItem(key: string, value: string): Promise<void> | void;
  removeItem(key: string): Promise<void> | void;
}

/** Wrap an {@link AsyncStorageLike} into the SDK's {@link CredentialStore}. */
export function fromAsyncStorage(storage: AsyncStorageLike): CredentialStore {
  return {
    async get(key) {
      const value = await Promise.resolve(storage.getItem(key));
      return value == null ? undefined : value;
    },
    async set(key, value) {
      await Promise.resolve(storage.setItem(key, value));
    },
    async remove(key) {
      await Promise.resolve(storage.removeItem(key));
    },
  };
}

/**
 * Adapt a synchronous `Storage`-shaped object (browser `localStorage` /
 * `sessionStorage`) into the SDK's async {@link CredentialStore}.
 */
export interface SyncStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Wrap a synchronous `Storage` (e.g., `localStorage`) into a {@link CredentialStore}. */
export function fromLocalStorage(storage: SyncStorageLike): CredentialStore {
  return {
    async get(key) {
      const value = storage.getItem(key);
      return value == null ? undefined : value;
    },
    async set(key, value) {
      storage.setItem(key, value);
    },
    async remove(key) {
      storage.removeItem(key);
    },
  };
}
