/**
 * Device-id mint + persist.
 *
 * The SDK auto-mints a per-device identifier on first activation and
 * persists it via a pluggable {@link CredentialStore}. Callers therefore do
 * NOT have to manage `deviceId` themselves — `Isa.withKeycode({ keycode,
 * email })` returns a fully usable instance.
 *
 * The minted id is a 32-character hex string (128 bits of randomness),
 * sourced from `crypto.getRandomValues`. The server places no structural
 * requirement on the value; the only invariant is that it is stable across
 * a device's lifetime so HMAC signatures stay verifiable.
 */

import { type CredentialStore, CREDENTIAL_KEYS } from './credentialStore';

/**
 * 16 random bytes = 128 bits of entropy. Matches Stripe's `cus_…` /
 * `pi_…` id lengths in security level and renders to 32 hex chars.
 */
const DEVICE_ID_BYTES = 16;

/**
 * Load the persisted device id from `store`, or mint a new one and persist
 * it. The result is stable across calls within a single process AND across
 * process boots (as long as `store` is persistent — the in-memory default
 * is not).
 */
export async function loadOrMintDeviceId(store: CredentialStore): Promise<string> {
  const existing = await store.get(CREDENTIAL_KEYS.deviceId);
  if (existing && existing.length > 0) return existing;
  const minted = mintDeviceId();
  await store.set(CREDENTIAL_KEYS.deviceId, minted);
  return minted;
}

/** Generate a fresh 128-bit hex device id. */
export function mintDeviceId(): string {
  const g = globalThis as { crypto?: Crypto };
  if (!g.crypto?.getRandomValues) {
    throw new Error('storage: crypto.getRandomValues is unavailable; cannot mint deviceId');
  }
  const bytes = new Uint8Array(DEVICE_ID_BYTES);
  g.crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
