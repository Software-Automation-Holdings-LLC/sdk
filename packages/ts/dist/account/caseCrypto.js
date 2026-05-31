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
import { resolveSubtle, base64ToBytes, bytesToBase64, bytesToBase64Url, systemRandomBytes, } from '../core/index.js';
import { IsaError } from '../zyins/apiError.js';
/** AES-256 data-key length in bytes. */
const KEY_BYTES = 32;
/** AES-GCM nonce length in bytes (96-bit, the GCM-recommended size). */
const IV_BYTES = 12;
/** AES-GCM authentication-tag length in bits. */
const TAG_BITS = 128;
/** AES-GCM authentication-tag length in bytes. */
const TAG_BYTES = TAG_BITS / 8;
/** WebCrypto algorithm name for the data-key import + AES-GCM operations. */
const ALGORITHM = 'AES-GCM';
/** Context label passed to runtime resolvers for error attribution. */
const CASE_CRYPTO_CONTEXT = 'CaseCrypto';
/**
 * Raised when an envelope fails AES-GCM authentication — a tampered, corrupt,
 * or `product`-mismatched payload, or a wrong fragment key. The recipient
 * cannot recover the plaintext; surface it as a terminal decrypt failure.
 */
export class IsaCaseDecryptError extends IsaError {
    constructor(message) {
        super(message);
        this.name = 'IsaCaseDecryptError';
    }
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
export async function encryptCase(product, payload, options = {}) {
    const subtle = resolveSubtle(options.subtle, CASE_CRYPTO_CONTEXT);
    const random = options.randomBytes ?? systemRandomBytes;
    const rawKey = random(KEY_BYTES);
    const iv = random(IV_BYTES);
    const key = await importKey(subtle, rawKey, ['encrypt']);
    const serialized = JSON.stringify(payload);
    if (serialized === undefined) {
        throw new Error('CaseCrypto: payload must be JSON-serializable');
    }
    const plaintext = new TextEncoder().encode(serialized);
    const sealed = new Uint8Array(await subtle.encrypt(gcmParams(iv, product), key, toArrayBuffer(plaintext)));
    const splitAt = sealed.length - TAG_BYTES;
    return {
        envelope: {
            ciphertext: bytesToBase64(sealed.subarray(0, splitAt)),
            iv: bytesToBase64(iv),
            tag: bytesToBase64(sealed.subarray(splitAt)),
        },
        keyFragment: bytesToBase64Url(rawKey),
    };
}
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
export async function decryptCase(product, envelope, keyFragment, options = {}) {
    const subtle = resolveSubtle(options.subtle, CASE_CRYPTO_CONTEXT);
    const rawKey = base64ToBytes(keyFragment);
    const iv = base64ToBytes(envelope.iv);
    const key = await importKey(subtle, rawKey, ['decrypt']);
    const sealed = concat(base64ToBytes(envelope.ciphertext), base64ToBytes(envelope.tag));
    const plaintext = await openSealed(subtle, key, iv, product, sealed);
    return JSON.parse(new TextDecoder().decode(plaintext));
}
/** Imports raw key bytes as a non-extractable AES-GCM key. */
function importKey(subtle, rawKey, usages) {
    return subtle.importKey('raw', toArrayBuffer(rawKey), { name: ALGORITHM }, false, [...usages]);
}
/** Builds the AES-GCM parameter bag with `product` bound as AEAD data. */
function gcmParams(iv, product) {
    return {
        name: ALGORITHM,
        iv: toArrayBuffer(iv),
        additionalData: toArrayBuffer(new TextEncoder().encode(product)),
        tagLength: TAG_BITS,
    };
}
/**
 * Copies bytes into a fresh, concrete `ArrayBuffer`-backed view. WebCrypto's
 * lib.dom `BufferSource` typing rejects the `ArrayBufferLike` generic that
 * flows out of the {@link RandomBytes} facade and base64 decoders; this
 * narrows the backing buffer without an `as` cast.
 */
function toArrayBuffer(bytes) {
    const copy = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(copy).set(bytes);
    return copy;
}
/** Runs AES-GCM decrypt, mapping the opaque WebCrypto failure to a typed error. */
async function openSealed(subtle, key, iv, product, sealed) {
    try {
        return new Uint8Array(await subtle.decrypt(gcmParams(iv, product), key, toArrayBuffer(sealed)));
    }
    catch (err) {
        throw new IsaCaseDecryptError(`case envelope failed authentication for product ${product}: wrong key, wrong product, or tampered ciphertext (${err.message})`);
    }
}
/** Concatenates two byte arrays into a fresh buffer. */
function concat(head, tail) {
    const out = new Uint8Array(head.length + tail.length);
    out.set(head, 0);
    out.set(tail, head.length);
    return out;
}
//# sourceMappingURL=caseCrypto.js.map