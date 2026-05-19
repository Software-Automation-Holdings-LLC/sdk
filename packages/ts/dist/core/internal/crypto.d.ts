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
export declare function resolveSubtle(injected?: SubtleCrypto, context?: string): SubtleCrypto;
/**
 * Converts an ArrayBuffer to a lowercase hex string.
 *
 * @param buffer The ArrayBuffer to convert.
 * @returns      Hex-encoded string (lowercase, 2 chars per byte).
 */
export declare function arrayBufferToHex(buffer: ArrayBuffer): string;
/**
 * Resolves the fetch implementation from the optional injection or the global.
 * Centralizes the resolution so modules do not read `globalThis.fetch` directly.
 *
 * @param injected Optional fetch override.
 * @param context  Context string for the error message (e.g., "Algosure").
 * @returns        The resolved fetch implementation.
 * @throws         Error if fetch is not available.
 */
export declare function resolveFetch(injected?: typeof fetch, context?: string): typeof fetch;
/**
 * Base64-encodes a UTF-8 string in any JS runtime.
 *
 * The browser `btoa` only accepts Latin-1 (code points <= 255); Node's
 * `Buffer` handles UTF-8 directly. This helper picks the right encoder so
 * callers never emit `InvalidCharacterError` on non-ASCII input
 * (international emails, CJK characters, etc.).
 */
export declare function base64EncodeUtf8(input: string): string;
/**
 * Clock facade — all current-time reads go through this interface.
 * Provides an injection point for tests to control time-sensitive behavior.
 */
export type Clock = () => number;
/**
 * Default clock uses the system time. Override in tests by passing a custom
 * clock to functions that accept one.
 */
export declare const systemClock: Clock;
//# sourceMappingURL=crypto.d.ts.map