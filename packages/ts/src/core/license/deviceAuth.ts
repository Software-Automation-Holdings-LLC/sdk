/**
 * Device authentication utilities for the ZyINS/BPP API.
 *
 * Provides HMAC-SHA256 signature computation and header building for the
 * License-based authentication flow. The device ID is cryptographically
 * bound to each request body via the X-Device-Signature header.
 *
 * Signatures here must be preserved — bpp2.0 depends on them.
 *
 * @see go/zyins/server/auth_middleware.go
 * @see go/zyins/server/device_signature.go
 */

import {
  base64EncodeUtf8,
  resolveSubtle,
  arrayBufferToHex,
  type Clock,
  systemClock,
} from '../internal/crypto';

const QUOTE_CHAR = '"';
/** Module label used for error attribution by runtime resolvers. */
const LICENSE_CONTEXT = 'License';
/** Prefix for errors raised inside the License module. */
const LICENSE_ERROR_PREFIX = `${LICENSE_CONTEXT}: `;

/**
 * Strips surrounding double-quote characters from a string.
 * AsyncStorage values may retain JSON serialization quotes depending on the
 * read/write path, so all auth values are sanitized before use.
 */
export const stripQuotes = (value: string): string =>
  value.length >= 2 && value.startsWith(QUOTE_CHAR) && value.endsWith(QUOTE_CHAR)
    ? value.slice(1, -1)
    : value;

/**
 * Computes hex(HMAC-SHA256(body, deviceId)) using the Web Crypto API.
 *
 * @param body     The raw request body string.
 * @param deviceId The persistent device identifier (random_string).
 * @param subtle   Optional SubtleCrypto instance. Defaults to globalThis.crypto.subtle.
 * @returns        Hex-encoded HMAC-SHA256 signature.
 */
export const computeDeviceSignature = async (
  body: string,
  deviceId: string,
  subtle?: SubtleCrypto,
): Promise<string> => {
  const cryptoSubtle = resolveSubtle(subtle, LICENSE_CONTEXT);
  const cleanDeviceId = stripQuotes(deviceId);
  const encoder = new TextEncoder();
  const key = await cryptoSubtle.importKey(
    'raw',
    encoder.encode(cleanDeviceId),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await cryptoSubtle.sign('HMAC', key, encoder.encode(body));
  return arrayBufferToHex(signature);
};

/**
 * Builds the legacy Authorization: License header value.
 *
 * @deprecated Prefer {@link buildLicenseHMACHeaders} for new code. This helper
 * remains for backward-compatibility with existing bpp2.0 call sites and will
 * be removed once all consumers are migrated to HMAC signing.
 *
 * @param licenseKey The BPP license key.
 * @param orderId    The order/keycode identifier.
 * @param email      The user email address.
 * @returns          The full Authorization header value.
 */
export const buildLicenseHeader = (
  licenseKey: string,
  orderId: string,
  email: string,
): string => {
  const payload = `${stripQuotes(licenseKey)}:${stripQuotes(orderId)}:${stripQuotes(email)}`;
  return `License ${base64Encode(payload)}`;
};

/**
 * Headers emitted by {@link buildLicenseHMACHeaders}.
 */
export interface LicenseHMACHeaders {
  Authorization: string;
  'X-Device-ID': string;
  'X-Device-Signature': string;
  'X-License-Method': string;
  'X-License-URI': string;
  'X-License-Timestamp': string;
}

/**
 * Builds the HMAC-signed License authentication headers, binding the license
 * credentials to a specific request (method, URI, body) via HMAC-SHA256.
 *
 * This is the HMAC successor to {@link buildLicenseHeader}: the license
 * identity travels in the Authorization header, while the per-request
 * signature lives in X-Device-Signature over the canonical string
 * `${method}\n${requestURI}\n${timestamp}\n${body}`.
 *
 * @param licenseKey  The BPP license key.
 * @param orderId     The order/keycode identifier.
 * @param email       The user email address.
 * @param method      HTTP method (GET, POST, etc.).
 * @param requestURI  Request path including query string (e.g., /v1/accounts?x=1).
 * @param body        Raw request body string (empty string for GET/HEAD).
 * @param deviceId    The persistent device identifier (random_string).
 * @param clock       Injectable clock facade. Defaults to systemClock.
 * @param subtle      Optional SubtleCrypto instance. Defaults to globalThis.crypto.subtle.
 */
export const buildLicenseHMACHeaders = async (
  licenseKey: string,
  orderId: string,
  email: string,
  method: string,
  requestURI: string,
  body: string,
  deviceId: string,
  clock: Clock = systemClock,
  subtle?: SubtleCrypto,
): Promise<LicenseHMACHeaders> => {
  const timestamp = String(clock());
  // Server's verifyDeviceSignature (go/zyins/server/device_signature.go) currently
  // signs body bytes only. The X-License-{Method,URI,Timestamp} headers ride along
  // for future canonical-string verification (task #194 server refactor) and
  // observability, but the signature itself is HMAC-SHA256(body, deviceId).
  const signature = await computeDeviceSignature(body, deviceId, subtle);
  return {
    Authorization: buildLicenseHeader(licenseKey, orderId, email),
    'X-Device-ID': stripQuotes(deviceId),
    'X-Device-Signature': signature,
    'X-License-Method': method,
    'X-License-URI': requestURI,
    'X-License-Timestamp': timestamp,
  };
};

/**
 * Wraps {@link base64EncodeUtf8} so callers get a License-prefixed error if
 * no encoder is available. UTF-8 safe — international emails no longer throw
 * `InvalidCharacterError` in browser `btoa` paths.
 */
function base64Encode(input: string): string {
  try {
    return base64EncodeUtf8(input);
  } catch (err) {
    throw new Error(LICENSE_ERROR_PREFIX + (err as Error).message);
  }
}
