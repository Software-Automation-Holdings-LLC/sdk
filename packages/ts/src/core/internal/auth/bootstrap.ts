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

import { arrayBufferToHex, resolveSubtle } from "../crypto.js";

const signatureHeaderName = "ISA-Signature";

type NodeCreateHmac = typeof import("node:crypto").createHmac;
type NodeCryptoModule = Pick<typeof import("node:crypto"), "createHmac">;
type ProcessWithBuiltins = NodeJS.Process & {
  getBuiltinModule?: (moduleName: string) => unknown;
};

declare const require: undefined | ((moduleName: string) => unknown);

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
  /** Header name callers should set. */
  readonly headerName: "ISA-Signature";
  /** `t=<ts>,v1=<hex>` — ready to set as the header value. */
  readonly headerValue: string;
  /** Complete header line for docs and conformance output. */
  readonly headerLine: string;
}

/**
 * Synchronous Node-only implementation. Used by the conformance test and
 * any server-side code that runs in Node ≥20.16. Browser callers should use
 * {@link buildBootstrapSignatureAsync} which delegates to SubtleCrypto.
 */
export function buildBootstrapSignature(input: BootstrapInput): BootstrapSignature {
  const serializedBody = serializeBootstrapBody(input);
  const canonical = buildCanonical(input.timestamp, input.method, input.path, serializedBody);
  const hex = getNodeCreateHmac()("sha256", input.licenseKey).update(canonical).digest("hex");
  return buildSignatureResult(input, serializedBody, canonical, hex);
}

/**
 * Browser-safe variant using SubtleCrypto. Identical bytes, async return.
 */
export async function buildBootstrapSignatureAsync(
  input: BootstrapInput,
  subtle?: SubtleCrypto,
): Promise<BootstrapSignature> {
  const cryptoSubtle = resolveSubtle(subtle, "Bootstrap");
  const serializedBody = serializeBootstrapBody(input);
  const canonical = buildCanonical(input.timestamp, input.method, input.path, serializedBody);
  const encoder = new TextEncoder();
  const key = await cryptoSubtle.importKey(
    "raw",
    encoder.encode(input.licenseKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await cryptoSubtle.sign("HMAC", key, encoder.encode(canonical));
  const hex = arrayBufferToHex(sig);
  return buildSignatureResult(input, serializedBody, canonical, hex);
}

/**
 * Load Node crypto only for the sync helper so browser bundles can import
 * the async SubtleCrypto path without resolving node built-ins.
 */
function getNodeCreateHmac(): NodeCreateHmac {
  const getBuiltinModule = (globalThis.process as ProcessWithBuiltins | undefined)?.getBuiltinModule;
  if (getBuiltinModule) {
    return (getBuiltinModule("node:crypto") as NodeCryptoModule).createHmac;
  }

  if (typeof require === "function") {
    return (require("node:crypto") as NodeCryptoModule).createHmac;
  }

  throw new Error("buildBootstrapSignature requires Node 20.16+ crypto; use buildBootstrapSignatureAsync in browsers");
}

function buildSignatureResult(
  input: BootstrapInput,
  serializedBody: string,
  canonical: string,
  hex: string,
): BootstrapSignature {
  const headerValue = `t=${input.timestamp},v1=${hex}`;
  return {
    serializedBody,
    canonical,
    hex,
    headerName: signatureHeaderName,
    headerValue,
    headerLine: `${signatureHeaderName}: ${headerValue}`,
  };
}

/**
 * Hand-rolled JSON serialization to guarantee key order and no whitespace.
 * JSON.stringify with the keys-array form pins order across engines and
 * skips Object.keys insertion-order ambiguity.
 */
function serializeBootstrapBody(input: BootstrapInput): string {
  return JSON.stringify({
    keycode: input.keycode,
    email: input.email,
    deviceId: input.deviceId,
  });
}

function buildCanonical(timestamp: number, method: string, path: string, body: string): string {
  return `${timestamp}.${method.toUpperCase()} ${path}.${body}`;
}
