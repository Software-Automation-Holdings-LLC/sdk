/**
 * Bytewise conformance gate for the embedded HMAC bootstrap signature.
 *
 * The fixture at tests/conformance/fixtures/auth-vector.json (repo root)
 * is the binding contract. Sibling SDKs in Go, Python, PHP, and C# MUST
 * reproduce the identical hex against the same inputs.
 *
 * If this test fails after an intentional change to the auth wire format,
 * regenerate the fixture, update api/guides/authentication-advanced.md,
 * and bump every SDK's major version — the change is breaking.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

import {
  buildBootstrapSignature,
  buildBootstrapSignatureAsync,
} from '../../src/core/internal/auth/bootstrap';

interface AuthVectorFixture {
  readonly inputs: {
    readonly keycode: string;
    readonly email: string;
    readonly licenseKey: string;
    readonly deviceId: string;
    readonly method: string;
    readonly path: string;
    readonly timestamp: number;
  };
  readonly serializedBody: string;
  readonly canonical: string;
  readonly expected: {
    readonly algorithm: 'HMAC-SHA256';
    readonly hex: string;
    readonly header: string;
  };
}

const fixturePath = resolve(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'tests',
  'conformance',
  'fixtures',
  'auth-vector.json',
);

const fixture: AuthVectorFixture = JSON.parse(readFileSync(fixturePath, 'utf8'));

describe('embedded HMAC bootstrap signature — auth vector', () => {
  it('serializes the body in source order with no whitespace', () => {
    const result = buildBootstrapSignature(fixture.inputs);
    expect(result.serializedBody).toBe(fixture.serializedBody);
  });

  it('builds the canonical signing string per the documented form', () => {
    const result = buildBootstrapSignature(fixture.inputs);
    expect(result.canonical).toBe(fixture.canonical);
  });

  it('reproduces the documented hex bytewise (sync / Node crypto)', () => {
    const result = buildBootstrapSignature(fixture.inputs);
    expect(result.hex).toBe(fixture.expected.hex);
  });

  it('emits the ISA-Signature header in the documented form', () => {
    const result = buildBootstrapSignature(fixture.inputs);
    expect(result.header).toBe(fixture.expected.header);
  });

  it('reproduces the documented hex via SubtleCrypto (browser path)', async () => {
    // Node ≥20 exposes globalThis.crypto.subtle; the SubtleCrypto path
    // is what bpp2.0 actually uses in the browser. Asserting it here
    // proves both code paths agree on the bytes.
    const result = await buildBootstrapSignatureAsync(fixture.inputs);
    expect(result.hex).toBe(fixture.expected.hex);
    expect(result.serializedBody).toBe(fixture.serializedBody);
  });

  it('keeps deviceId out of the canonical string outside the body', () => {
    // Anti-regression: an earlier draft included deviceId in the canonical
    // path. Locked spec sends it as X-Device-ID header only; the only
    // canonical appearance is inside the body JSON for POST /v1/sessions.
    const bodyStart = fixture.canonical.indexOf(fixture.serializedBody);
    const canonicalBeforeBody = fixture.canonical.slice(0, bodyStart);
    expect(canonicalBeforeBody).not.toContain(fixture.inputs.deviceId);
  });
});
