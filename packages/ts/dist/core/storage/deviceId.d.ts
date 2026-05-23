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
import { type CredentialStore } from './credentialStore';
/**
 * Load the persisted device id from `store`, or mint a new one and persist
 * it. The result is stable across calls within a single process AND across
 * process boots (as long as `store` is persistent — the in-memory default
 * is not).
 */
export declare function loadOrMintDeviceId(store: CredentialStore): Promise<string>;
/** Generate a fresh 128-bit hex device id. */
export declare function mintDeviceId(): string;
//# sourceMappingURL=deviceId.d.ts.map