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
import { type Clock } from '../internal/crypto.js';
/**
 * Strips surrounding double-quote characters from a string.
 * AsyncStorage values may retain JSON serialization quotes depending on the
 * read/write path, so all auth values are sanitized before use.
 */
export declare const stripQuotes: (value: string) => string;
/**
 * Computes hex(HMAC-SHA256(body, deviceId)) using the Web Crypto API.
 *
 * @param body     The raw request body string.
 * @param deviceId The persistent device identifier (random_string).
 * @param subtle   Optional SubtleCrypto instance. Defaults to globalThis.crypto.subtle.
 * @returns        Hex-encoded HMAC-SHA256 signature.
 */
export declare const computeDeviceSignature: (body: string, deviceId: string, subtle?: SubtleCrypto) => Promise<string>;
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
export declare const buildLicenseHeader: (licenseKey: string, orderId: string, email: string) => string;
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
export declare const buildLicenseHMACHeaders: (licenseKey: string, orderId: string, email: string, method: string, requestURI: string, body: string, deviceId: string, clock?: Clock, subtle?: SubtleCrypto) => Promise<LicenseHMACHeaders>;
//# sourceMappingURL=deviceAuth.d.ts.map