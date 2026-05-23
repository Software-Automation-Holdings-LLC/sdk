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
/**
 * Inputs to the bootstrap signature. Mirrors the auth-vector fixture
 * one-for-one. Field ORDER matters for serializedBody.
 */
export interface BootstrapInput {
    /** Per-seat keycode (e.g. SDV-HWH-WDD). */
    readonly keycode: string;
    /** License-owner email (lowercased lookup key server-side). */
    readonly email: string;
    /** Long-lived license key. HMAC key only — never on the wire. */
    readonly licenseKey: string;
    /** Stable per-install device id. Appears in body + X-Device-ID header. */
    readonly deviceId: string;
    /** Uppercase HTTP method, typically "POST". */
    readonly method: string;
    /** Request path with leading /v1/, no query string. */
    readonly path: string;
    /** Unix seconds. Server tolerates 5 minutes of skew. */
    readonly timestamp: number;
}
/**
 * Output bundle. The signing helper returns every intermediate so that
 * conformance tests can assert each stage independently — if a future
 * regression flips the serializedBody, the failure points at exactly
 * that stage instead of just "hex differs".
 */
export interface BootstrapSignature {
    /** JSON body exactly as sent on the wire. Bytes signed verbatim. */
    readonly serializedBody: string;
    /** `<ts>.<METHOD> <path>.<body>` — the HMAC input. */
    readonly canonical: string;
    /** Lowercase hex HMAC-SHA256 over canonical, keyed by licenseKey. */
    readonly hex: string;
    /** `ISA-Signature: t=<ts>,v1=<hex>` — ready to set as a header value. */
    readonly header: string;
}
/**
 * Synchronous Node-only implementation. Used by the conformance test and
 * any server-side code that runs in Node ≥20. Browser callers should use
 * {@link buildBootstrapSignatureAsync} which delegates to SubtleCrypto.
 */
export declare function buildBootstrapSignature(input: BootstrapInput): BootstrapSignature;
/**
 * Browser-safe variant using SubtleCrypto. Identical bytes, async return.
 */
export declare function buildBootstrapSignatureAsync(input: BootstrapInput, subtle?: SubtleCrypto): Promise<BootstrapSignature>;
//# sourceMappingURL=bootstrap.d.ts.map