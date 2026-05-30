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
export function resolveSubtle(injected?: SubtleCrypto, context = 'Crypto'): SubtleCrypto {
  if (injected) return injected;
  const g = globalThis as { crypto?: Crypto };
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
export function arrayBufferToHex(buffer: ArrayBuffer): string {
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
export function resolveFetch(injected?: typeof fetch, context = 'Crypto'): typeof fetch {
  if (injected) return injected;
  const g = globalThis as { fetch?: typeof fetch };
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
export function base64EncodeUtf8(input: string): string {
  const g = globalThis as {
    btoa?: (s: string) => string;
    Buffer?: { from(s: string, e: string): { toString(e: string): string } };
  };
  if (g.Buffer) return g.Buffer.from(input, 'utf8').toString('base64');
  if (typeof g.btoa === 'function') {
    const bytes = new TextEncoder().encode(input);
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return g.btoa(binary);
  }
  throw new Error('Crypto: no base64 encoder available (btoa or Buffer)');
}

/**
 * Decodes a standard or URL-safe base64 string to raw bytes in any JS
 * runtime. Accepts the URL-safe alphabet (`-`/`_`) and missing padding so a
 * fragment-borne base64url key decodes without a separate code path.
 */
export function base64ToBytes(input: string): Uint8Array {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const g = globalThis as {
    atob?: (s: string) => string;
    Buffer?: { from(s: string, e: string): Uint8Array };
  };
  if (g.Buffer) return Uint8Array.from(g.Buffer.from(normalized, 'base64'));
  if (typeof g.atob === 'function') {
    const binary = g.atob(padBase64(normalized));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
  throw new Error('Crypto: no base64 decoder available (atob or Buffer)');
}

/**
 * Standard-base64-encodes raw bytes in any JS runtime. Emits the padded std
 * alphabet (`+`/`/`/`=`) to match what the server stores and returns on GET
 * for ciphertext / iv / tag.
 */
export function bytesToBase64(bytes: Uint8Array): string {
  const g = globalThis as {
    btoa?: (s: string) => string;
    Buffer?: { from(b: Uint8Array): { toString(e: string): string } };
  };
  if (g.Buffer) return g.Buffer.from(bytes).toString('base64');
  if (typeof g.btoa === 'function') {
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return g.btoa(binary);
  }
  throw new Error('Crypto: no base64 encoder available (btoa or Buffer)');
}

/**
 * URL-safe-base64-encodes raw bytes (RFC 4648 §5, padding stripped). Used for
 * the share-link fragment key so the value survives a URL without
 * percent-encoding. The companion {@link base64ToBytes} accepts this form.
 */
export function bytesToBase64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Re-pads a normalized (std-alphabet) base64 string to a length multiple of 4. */
function padBase64(input: string): string {
  const remainder = input.length % 4;
  return remainder === 0 ? input : input + '='.repeat(4 - remainder);
}

/**
 * CSPRNG facade — all random-byte reads go through this interface so callers
 * never touch `crypto.getRandomValues` directly and tests can inject a
 * deterministic source.
 */
export type RandomBytes = (length: number) => Uint8Array;

/**
 * Default random source backed by `crypto.getRandomValues`. Override in tests
 * by passing a custom {@link RandomBytes} to functions that accept one.
 *
 * @throws Error if `crypto.getRandomValues` is unavailable in the environment.
 */
export const systemRandomBytes: RandomBytes = (length: number): Uint8Array => {
  const g = globalThis as { crypto?: Crypto };
  if (!g.crypto?.getRandomValues) {
    throw new Error('Crypto: crypto.getRandomValues is not available in this environment');
  }
  const bytes = new Uint8Array(length);
  g.crypto.getRandomValues(bytes);
  return bytes;
};

/**
 * Clock facade — all current-time reads go through this interface.
 * Provides an injection point for tests to control time-sensitive behavior.
 */
export type Clock = () => number;

/**
 * Default clock uses the system time. Override in tests by passing a custom
 * clock to functions that accept one.
 */
export const systemClock: Clock = () => Date.now();
