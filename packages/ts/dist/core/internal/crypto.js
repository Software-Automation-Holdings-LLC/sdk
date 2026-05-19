/**
 * Shared cryptographic utilities for internal use across the platform-client.
 *
 * Provides common helpers for SubtleCrypto resolution and hex encoding to
 * eliminate duplication between algosure/hmac.ts and license/deviceAuth.ts.
 */
/**
 * Resolves the SubtleCrypto instance from the optional injection or the global.
 * Throws if SubtleCrypto is unavailable in the environment.
 *
 * @param injected Optional SubtleCrypto instance to use.
 * @param context  Context string for the error message (e.g., "Algosure", "License").
 * @returns        The resolved SubtleCrypto instance.
 * @throws         Error if SubtleCrypto is not available.
 */
export function resolveSubtle(injected, context = 'Crypto') {
    if (injected)
        return injected;
    const g = globalThis;
    if (!g.crypto?.subtle) {
        throw new Error(`${context}: SubtleCrypto is not available in this environment`);
    }
    return g.crypto.subtle;
}
/**
 * Converts an ArrayBuffer to a lowercase hex string.
 *
 * @param buffer The ArrayBuffer to convert.
 * @returns      Hex-encoded string (lowercase, 2 chars per byte).
 */
export function arrayBufferToHex(buffer) {
    return Array.from(new Uint8Array(buffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}
/**
 * Resolves the fetch implementation from the optional injection or the global.
 * Centralizes the resolution so modules do not read `globalThis.fetch` directly.
 *
 * @param injected Optional fetch override.
 * @param context  Context string for the error message (e.g., "Algosure").
 * @returns        The resolved fetch implementation.
 * @throws         Error if fetch is not available.
 */
export function resolveFetch(injected, context = 'Crypto') {
    if (injected)
        return injected;
    const g = globalThis;
    if (!g.fetch) {
        throw new Error(`${context}: fetch is not available in this environment`);
    }
    return g.fetch.bind(globalThis);
}
/**
 * Base64-encodes a UTF-8 string in any JS runtime.
 *
 * The browser `btoa` only accepts Latin-1 (code points <= 255); Node's
 * `Buffer` handles UTF-8 directly. This helper picks the right encoder so
 * callers never emit `InvalidCharacterError` on non-ASCII input
 * (international emails, CJK characters, etc.).
 */
export function base64EncodeUtf8(input) {
    const g = globalThis;
    if (g.Buffer)
        return g.Buffer.from(input, 'utf8').toString('base64');
    if (typeof g.btoa === 'function') {
        const bytes = new TextEncoder().encode(input);
        let binary = '';
        for (const byte of bytes)
            binary += String.fromCharCode(byte);
        return g.btoa(binary);
    }
    throw new Error('Crypto: no base64 encoder available (btoa or Buffer)');
}
/**
 * Default clock uses the system time. Override in tests by passing a custom
 * clock to functions that accept one.
 */
export const systemClock = () => Date.now();
//# sourceMappingURL=crypto.js.map