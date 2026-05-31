/**
 * Embedded HMAC bootstrap signature for POST /v1/sessions.
 *
 * This module pins the byte-exact wire format documented at
 * api/guides/authentication-advanced.md#test-vector and reproduced in
 * tests/conformance/fixtures/auth-vector.json. Sibling SDKs in Go, Python,
 * PHP, and C# MUST reproduce the identical hex against the same inputs.
 *
 * Two-stage flow:
 *   1. Serialize the request body as JSON, keys in source order
 *      (keycode, email, deviceId), no whitespace, no trailing newline.
 *   2. Build the canonical signing string and HMAC-SHA256 it with the
 *      licenseKey as the key.
 *
 * Why a dedicated module: the bootstrap signature predates any session
 * (no sessionSecret exists yet), uses the licenseKey as HMAC key, and is
 * the only call where deviceId appears in the body. The steady-state
 * session-signing helper (core/auth/signRequest) handles all other calls.
 *
 * If you find yourself adding inputs to BootstrapInput, stop. The locked
 * contract has exactly these seven fields. Adding a field is a wire
 * break and requires a major SDK bump + doc + fixture update.
 */
import { createHmac as nodeCreateHmac } from 'node:crypto';
import { resolveSubtle, arrayBufferToHex } from '../crypto.js';
/**
 * Synchronous Node-only implementation. Used by the conformance test and
 * any server-side code that runs in Node ≥20. Browser callers should use
 * {@link buildBootstrapSignatureAsync} which delegates to SubtleCrypto.
 */
export function buildBootstrapSignature(input) {
    const serializedBody = serializeBootstrapBody(input);
    const canonical = buildCanonical(input.timestamp, input.method, input.path, serializedBody);
    const hex = nodeCreateHmac('sha256', input.licenseKey).update(canonical).digest('hex');
    return {
        serializedBody,
        canonical,
        hex,
        header: `ISA-Signature: t=${input.timestamp},v1=${hex}`,
    };
}
/**
 * Browser-safe variant using SubtleCrypto. Identical bytes, async return.
 */
export async function buildBootstrapSignatureAsync(input, subtle) {
    const cryptoSubtle = resolveSubtle(subtle, 'Bootstrap');
    const serializedBody = serializeBootstrapBody(input);
    const canonical = buildCanonical(input.timestamp, input.method, input.path, serializedBody);
    const encoder = new TextEncoder();
    const key = await cryptoSubtle.importKey('raw', encoder.encode(input.licenseKey), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = await cryptoSubtle.sign('HMAC', key, encoder.encode(canonical));
    const hex = arrayBufferToHex(sig);
    return {
        serializedBody,
        canonical,
        hex,
        header: `ISA-Signature: t=${input.timestamp},v1=${hex}`,
    };
}
/**
 * Hand-rolled JSON serialization to guarantee key order and no whitespace.
 * JSON.stringify with the keys-array form pins order across engines and
 * skips Object.keys insertion-order ambiguity.
 */
function serializeBootstrapBody(input) {
    return JSON.stringify({
        keycode: input.keycode,
        email: input.email,
        deviceId: input.deviceId,
    });
}
function buildCanonical(timestamp, method, path, body) {
    return `${timestamp}.${method.toUpperCase()} ${path}.${body}`;
}
//# sourceMappingURL=bootstrap.js.map