/**
 * Tests for the legacy-blob variant of prequalify.
 *
 * The typed `prequalify` path is exercised in `prequalify.test.ts`; this
 * suite asserts only the legacy-blob-specific behaviour:
 *   - the opaque payload is JSON-serialized and sent verbatim,
 *   - the same License HMAC headers + idempotency-key derivation apply,
 *   - the typed `PrequalifyResult` is parsed back from a 2xx response,
 *   - ProblemDetails 4xx is mapped to the typed `PrequalifyError`.
 */

import { describe, expect, it } from 'vitest';
import { ZyInsClient } from '../../src/zyins/client';
import type { Transport, TransportRequest } from '../../src/zyins/transport';
import { PrequalifyError } from '../../src/zyins/errors';
import { TEST_AUTH, FIXED_CLOCK } from './fixtures';

interface CapturedCall {
  request: TransportRequest;
}

function recordingTransport(response: { status: number; body: string }): {
  transport: Transport;
  calls: CapturedCall[];
} {
  const calls: CapturedCall[] = [];
  const transport: Transport = async (request) => {
    calls.push({ request });
    return { status: response.status, body: response.body, headers: {} };
  };
  return { transport, calls };
}

/**
 * Persona discipline: the encoded payload mirrors the shape bpp2.0's
 * `prepEncObj` would produce — a flat-ish JSON object the legacy encoder
 * has been emitting unchanged for years.
 */
const LEGACY_PAYLOAD: Record<string, unknown> = {
  license_key: 'LIC-ABC-123',
  order_id: 'ORD-42',
  email: 'john.doe@acme-agency.com',
  products: 'colonial-penn.final-expense',
  applicant: {
    dob: '1962-04-18',
    sex: 'M',
    height_inches: 70,
    weight_pounds: 195,
    state: 'NC',
    nicotine_use: 'NONE',
    medications: [],
    conditions: [],
  },
  coverage: { type: 'face_value', amount: 100_000 },
};

describe('ZyInsClient.prequalifyLegacyBlob', () => {
  it('POSTs the encoded payload verbatim to /v1/prequalify', async () => {
    const { transport, calls } = recordingTransport({
      status: 200,
      body: JSON.stringify({
        plans: [
          {
            brand: 'colonial-penn',
            tier: 'preferred',
            monthly_premium: 42,
            face_value: 100_000,
            product_token: 'colonial-penn.final-expense',
          },
        ],
        request_id: 'req_test_legacy_1',
      }),
    });
    const client = new ZyInsClient({
      auth: TEST_AUTH,
      baseUrl: 'https://test.example',
      transport,
      clock: FIXED_CLOCK,
    });
    const result = await client.prequalifyLegacyBlob({ encodedPayload: LEGACY_PAYLOAD });
    expect(result.plans).toHaveLength(1);
    expect(result.plans[0]?.brand).toBe('colonial-penn');
    expect(result.requestId).toBe('req_test_legacy_1');
    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    expect(call.request.url).toBe('https://test.example/v1/prequalify');
    expect(call.request.method).toBe('POST');
    expect(call.request.body).toBe(JSON.stringify(LEGACY_PAYLOAD));
    expect(call.request.headers['X-Device-ID']).toBe('device-xyz-123');
    expect(call.request.headers['Authorization']).toMatch(/^License /);
    expect(call.request.headers['Content-Type']).toBe('application/json');
    expect(call.request.headers['Idempotency-Key']).toMatch(/^[0-9a-f]{64}$/);
  });

  it('returns a typed PrequalifyResult', async () => {
    const { transport } = recordingTransport({
      status: 200,
      body: JSON.stringify({
        plans: [
          {
            brand: 'mutual-of-omaha',
            tier: 'standard',
            monthly_premium: 51.25,
            face_value: 50_000,
            product_token: 'mutual-of-omaha.final-expense',
          },
        ],
        request_id: 'req_test_legacy_2',
      }),
    });
    const client = new ZyInsClient({
      auth: TEST_AUTH,
      baseUrl: 'https://test.example',
      transport,
      clock: FIXED_CLOCK,
    });
    const result = await client.prequalifyLegacyBlob({ encodedPayload: LEGACY_PAYLOAD });
    expect(result.plans[0]).toEqual({
      brand: 'mutual-of-omaha',
      tier: 'standard',
      monthlyPremium: 51.25,
      faceValue: 50_000,
      productToken: 'mutual-of-omaha.final-expense',
    });
  });

  it('maps ProblemDetails 400 to PrequalifyError', async () => {
    const { transport } = recordingTransport({
      status: 400,
      body: JSON.stringify({
        type: 'https://docs.isa.example/errors/validation',
        title: 'Validation failed',
        status: 400,
        code: 'validation_error',
        detail: 'applicant.dob is required',
        param: 'applicant.dob',
      }),
    });
    const client = new ZyInsClient({
      auth: TEST_AUTH,
      baseUrl: 'https://test.example',
      transport,
      clock: FIXED_CLOCK,
    });
    await expect(
      client.prequalifyLegacyBlob({ encodedPayload: LEGACY_PAYLOAD }),
    ).rejects.toBeInstanceOf(PrequalifyError);
  });

  it('round-trips an opaque blob — payload bytes are preserved exactly', async () => {
    const opaque: Record<string, unknown> = {
      foo: 'bar',
      nested: { a: 1, b: [2, 3, 4] },
      empty: null,
      unicode: 'café — 北京',
    };
    const { transport, calls } = recordingTransport({
      status: 200,
      body: JSON.stringify({ plans: [], request_id: 'req_opaque' }),
    });
    const client = new ZyInsClient({
      auth: TEST_AUTH,
      baseUrl: 'https://test.example',
      transport,
      clock: FIXED_CLOCK,
    });
    await client.prequalifyLegacyBlob({ encodedPayload: opaque });
    expect(calls[0]!.request.body).toBe(JSON.stringify(opaque));
  });
});
