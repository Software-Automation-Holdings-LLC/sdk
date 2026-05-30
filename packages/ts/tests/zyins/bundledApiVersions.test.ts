/**
 * Tests for the per-surface `apiVersion` map, `BundledApiVersions`
 * constant, and the resolution rules (override overlay + bundled fallback).
 *
 * Covers:
 *  - `BundledApiVersions` is frozen and matches the documented release table
 *  - Per-surface override resolves correctly; unset surfaces fall back
 *  - Type-test: scalar `apiVersion: 'v3'` is rejected (no shorthand)
 *  - Type-test: `Isa.withKeycode({ deviceId })` is rejected (SDK-internal)
 *  - End-to-end: `apiVersion: { quote: 'v2' }` pins the quote surface only
 */

import { describe, it, expect } from 'vitest';
import {
  BundledApiVersions,
  resolveApiVersions,
  Isa,
  LicenseAuth,
  inMemoryEngineWith,
  ENV_VAR_NAMES,
  type EnvReader,
  type Transport,
  type TransportRequest,
} from '../../src/zyins';
import { TEST_APPLICANT, TEST_AUTH, TEST_COVERAGE, TEST_PRODUCTS } from './fixtures';

function licenseEnv(): EnvReader {
  return {
    get: (n) =>
      n === ENV_VAR_NAMES.license.keycode
        ? TEST_AUTH.licenseKey
        : n === ENV_VAR_NAMES.license.email
          ? TEST_AUTH.email
          : undefined,
  };
}

function recordingTransport(response: { status: number; body: string }): {
  transport: Transport;
  calls: TransportRequest[];
} {
  const calls: TransportRequest[] = [];
  const transport: Transport = async (request) => {
    calls.push(request);
    return { status: response.status, body: response.body, headers: {} };
  };
  return { transport, calls };
}

describe('BundledApiVersions', () => {
  it('is frozen', () => {
    expect(Object.isFrozen(BundledApiVersions)).toBe(true);
  });

  it('matches the documented per-release table (docs/sdk-syntax-proposal §2.7)', () => {
    expect(BundledApiVersions).toEqual({
      prequalify: 'v2',
      quote: 'v2',
      datasets: 'v2',
      reference: 'v2',
      sessions: 'v1',
      branding: 'v1',
      cases: 'v1',
    });
  });
});

describe('resolveApiVersions', () => {
  it('returns the bundled table when no override is supplied', () => {
    const resolved = resolveApiVersions();
    expect(resolved).toEqual(BundledApiVersions);
  });

  it('overlays a per-surface override onto the bundled defaults', () => {
    const resolved = resolveApiVersions({ quote: 'v3' });
    expect(resolved.quote).toBe('v3');
    // Untouched surfaces keep their bundled values.
    expect(resolved.prequalify).toBe('v2');
    expect(resolved.cases).toBe('v1');
  });

  it('produces a frozen result that does not alias the bundled constant', () => {
    const resolved = resolveApiVersions({ datasets: 'v3' });
    expect(Object.isFrozen(resolved)).toBe(true);
    expect(resolved).not.toBe(BundledApiVersions);
    // Mutating the override after the fact must not affect the resolved view.
    expect(BundledApiVersions.datasets).toBe('v2');
  });
});

describe('Type tests — apiVersion shape (compile-time)', () => {
  it('rejects the scalar shorthand form', async () => {
    await Isa.withKeycode(
      { keycode: TEST_AUTH.licenseKey, email: TEST_AUTH.email },
      licenseEnv(),
      {
        // @ts-expect-error — string shorthand is not a valid apiVersion shape;
        // the SDK requires a per-surface map (or omission for bundled defaults).
        apiVersion: 'v3',
      },
    );
  });

  it('rejects deviceId on Isa.withKeycode (SDK-internal per §2.8)', async () => {
    await Isa.withKeycode(
      {
        keycode: TEST_AUTH.licenseKey,
        email: TEST_AUTH.email,
        // @ts-expect-error — deviceId is derived/persisted by the SDK; never a
        // constructor argument. See docs/sdk-syntax-proposal.md §2.8.
        deviceId: 'should-not-typecheck',
      },
      licenseEnv(),
    );
  });

  it('rejects deviceId on LicenseAuth.fromKeycode extras', () => {
    // @ts-expect-error — `IsaAuthSupplier.license` no longer carries
    // `deviceId`; the SDK derives it internally.
    LicenseAuth.fromKeycode(TEST_AUTH.licenseKey, TEST_AUTH.email, {
      deviceId: 'should-not-typecheck',
      orderId: TEST_AUTH.orderId,
    });
  });
});

describe('per-surface apiVersion resolution', () => {
  it('honors apiVersion: { quote: "v2" } and falls back to bundled for unset surfaces', async () => {
    const { transport } = recordingTransport({ status: 200, body: '{}' });
    const isa = await Isa.create({
      auth: LicenseAuth.fromKeycode(TEST_AUTH.licenseKey, TEST_AUTH.email, {
        orderId: TEST_AUTH.orderId,
        licenseKey: TEST_AUTH.licenseKey,
      }),
      apiVersion: { quote: 'v2' },
      engine: inMemoryEngineWith(transport),
    });

    expect(isa.apiVersion.quote).toBe('v2');
    expect(isa.apiVersion.prequalify).toBe(BundledApiVersions.prequalify);
    expect(isa.apiVersion.cases).toBe(BundledApiVersions.cases);
  });
});

// ---------------------------------------------------------------------------
// V3 facade routing — when consumers opt in via the per-surface map, the
// `isa.zyins.prequalify` selector must route to the v3 callable and hit the
// `/v3/prequalify` path. Without this the override silently falls through to
// the v2 callable (the gap this suite exists to lock down).
// ---------------------------------------------------------------------------

const PREQUALIFY_V3_BODY = JSON.stringify({
  object: 'prequalify_result',
  request_id: 'req_01HZK2N5GQR9T8X4B6FJW3Y1AS',
  idempotency_key: '550e8400-e29b-41d4-a716-446655440000',
  livemode: true,
  data: { plans: [] },
});

const QUOTE_V3_BODY = JSON.stringify({
  object: 'quote_result',
  request_id: 'req_01HZK2N5GQR9T8X4B6FJW3Y1AS',
  idempotency_key: '550e8400-e29b-41d4-a716-446655440000',
  livemode: true,
  data: { results: [] },
});

describe('v3 facade routing (selector dispatches to prequalifyV3 / quoteV3)', () => {
  it('routes isa.zyins.prequalify to prequalifyV3 when apiVersion.prequalify === "v3"', async () => {
    const { transport, calls } = recordingTransport({
      status: 200,
      body: PREQUALIFY_V3_BODY,
    });
    const isa = await Isa.create({
      auth: LicenseAuth.fromKeycode(TEST_AUTH.licenseKey, TEST_AUTH.email, {
        orderId: TEST_AUTH.orderId,
        licenseKey: TEST_AUTH.licenseKey,
      }),
      apiVersion: { prequalify: 'v3' },
      engine: inMemoryEngineWith(transport),
    });

    expect(isa.apiVersion.prequalify).toBe('v3');
    expect(isa.zyins.prequalify).toBe(isa.zyins.prequalifyV3);

    const env = await isa.zyins.prequalify({
      applicant: TEST_APPLICANT,
      coverage: TEST_COVERAGE,
      products: TEST_PRODUCTS,
    });

    expect(calls[0]?.url).toContain('/v3/prequalify');
    expect(env.requestId).toBe('req_01HZK2N5GQR9T8X4B6FJW3Y1AS');
    expect(env.livemode).toBe(true);
  });

  it('keeps the v2 alias when apiVersion is omitted (bundled default)', async () => {
    const { transport } = recordingTransport({ status: 200, body: '{}' });
    const isa = await Isa.create({
      auth: LicenseAuth.fromKeycode(TEST_AUTH.licenseKey, TEST_AUTH.email, {
        orderId: TEST_AUTH.orderId,
        licenseKey: TEST_AUTH.licenseKey,
      }),
      engine: inMemoryEngineWith(transport),
    });

    expect(isa.apiVersion.prequalify).toBe('v2');
    expect(isa.zyins.prequalify).toBe(isa.zyins.prequalifyV2);
  });

  it('routes isa.zyins.quote to quoteV3 when apiVersion.quote === "v3"', async () => {
    const { transport, calls } = recordingTransport({
      status: 200,
      body: QUOTE_V3_BODY,
    });
    const isa = await Isa.create({
      auth: LicenseAuth.fromKeycode(TEST_AUTH.licenseKey, TEST_AUTH.email, {
        orderId: TEST_AUTH.orderId,
        licenseKey: TEST_AUTH.licenseKey,
      }),
      apiVersion: { quote: 'v3' },
      engine: inMemoryEngineWith(transport),
    });

    expect(isa.apiVersion.quote).toBe('v3');
    expect(isa.zyins.quote).toBe(isa.zyins.quoteV3);

    const env = await isa.zyins.quote({
      applicant: TEST_APPLICANT,
      coverage: TEST_COVERAGE,
      products: TEST_PRODUCTS,
    });

    expect(calls[0]?.url).toContain('/v3/quote');
    expect(env.requestId).toBe('req_01HZK2N5GQR9T8X4B6FJW3Y1AS');
  });

  it('throws IsaConfigError when prequalifyV3 is called but pinned to v2', async () => {
    const { transport } = recordingTransport({ status: 200, body: '{}' });
    const isa = await Isa.create({
      auth: LicenseAuth.fromKeycode(TEST_AUTH.licenseKey, TEST_AUTH.email, {
        orderId: TEST_AUTH.orderId,
        licenseKey: TEST_AUTH.licenseKey,
      }),
      engine: inMemoryEngineWith(transport),
    });

    await expect(
      isa.zyins.prequalifyV3({
        applicant: TEST_APPLICANT,
        coverage: TEST_COVERAGE,
        products: TEST_PRODUCTS,
      }),
    ).rejects.toThrow(/apiVersion 'v3'/);
  });

  it('throws IsaConfigError when quoteV3 is called but quote is pinned to v2', async () => {
    const { transport } = recordingTransport({ status: 200, body: '{}' });
    const isa = await Isa.create({
      auth: LicenseAuth.fromKeycode(TEST_AUTH.licenseKey, TEST_AUTH.email, {
        orderId: TEST_AUTH.orderId,
        licenseKey: TEST_AUTH.licenseKey,
      }),
      engine: inMemoryEngineWith(transport),
    });

    await expect(
      isa.zyins.quoteV3({
        applicant: TEST_APPLICANT,
        coverage: TEST_COVERAGE,
        products: TEST_PRODUCTS,
      }),
    ).rejects.toThrow(/apiVersion 'v3'/);
  });
});
