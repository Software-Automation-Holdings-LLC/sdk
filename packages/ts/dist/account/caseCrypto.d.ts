/**
 * Zero-knowledge case crypto envelope (E2EE Phase 2).
 *
 * The platform stores opaque ciphertext and never holds a key: the SDK
 * generates a fresh 256-bit data key per case, encrypts the payload with
 * AES-256-GCM (the cleartext `product` tag is bound as additional
 * authenticated data), and carries the key only in the share-link fragment.
 * See `docs/design/case-store-e2ee.md`.
 *
 * WebCrypto returns the GCM auth tag appended to the ciphertext; the wire
 * contract carries `ciphertext` and `tag` separately (mirroring zyins #363),
 * so this module splits on encrypt and rejoins on decrypt.
 */
import { type RandomBytes } from '../core';
import { IsaError } from '../zyins/apiError';
/** The opaque crypto fields the server stores, all base64 (std alphabet). */
export interface TCaseEnvelope {
    /** Base64 AES-256-GCM ciphertext (auth tag stripped). */
    ciphertext: string;
    /** Base64 AES-GCM nonce. */
    iv: string;
    /** Base64 AES-GCM authentication tag. */
    tag: string;
}
/** Result of {@link encryptCase}: the wire envelope plus the fragment key. */
export interface TEncryptedCase {
    /** The base64 fields posted to `/v1/case`. */
    envelope: TCaseEnvelope;
    /** The data key, base64url-encoded for the `#k=` share-link fragment. */
    keyFragment: string;
}
/** Optional injection points for {@link encryptCase} / {@link decryptCase}. */
export interface TCaseCryptoOptions {
    /** SubtleCrypto override; defaults to `globalThis.crypto.subtle`. */
    subtle?: SubtleCrypto;
    /** CSPRNG override; defaults to {@link systemRandomBytes}. */
    randomBytes?: RandomBytes;
}
/**
 * Raised when an envelope fails AES-GCM authentication — a tampered, corrupt,
 * or `product`-mismatched payload, or a wrong fragment key. The recipient
 * cannot recover the plaintext; surface it as a terminal decrypt failure.
 */
export declare class IsaCaseDecryptError extends IsaError {
    constructor(message: string);
}
/**
 * Encrypts a JSON payload under a fresh 256-bit key, binding `product` as
 * AEAD additional data. Returns the base64 wire envelope and the base64url
 * fragment key. The key never leaves this call except as the returned
 * fragment value — the caller must keep it out of logs and telemetry.
 *
 * @example
 * ```ts
 * const { envelope, keyFragment } = await encryptCase('zyins', { input });
 * // POST envelope; assemble `${viewer}/c/${id}#k=${keyFragment}`
 * ```
 */
export declare function encryptCase(product: string, payload: unknown, options?: TCaseCryptoOptions): Promise<TEncryptedCase>;
/**
 * Decrypts a wire envelope with the fragment key, verifying the `product`
 * AEAD binding. Throws {@link IsaCaseDecryptError} on any authentication
 * failure (wrong key, wrong product, tampered ciphertext).
 *
 * @example
 * ```ts
 * const payload = await decryptCase('zyins', envelope, keyFragment);
 * ```
 */
export declare function decryptCase(product: string, envelope: TCaseEnvelope, keyFragment: string, options?: TCaseCryptoOptions): Promise<unknown>;
//# sourceMappingURL=caseCrypto.d.ts.map