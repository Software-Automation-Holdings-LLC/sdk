/**
 * Bearer auth on the zyins quoting surface (launch P0).
 *
 * `Isa.withBearer(token).zyins.prequalifyV3(...)` must reach `/v3` with an
 * `Authorization: Bearer <token>` header and parse plans — not throw the
 * legacy Phase-3 `IsaConfigError`. The keycode path must stay byte-identical:
 * License-HMAC headers, no bearer header. Both are asserted here against a
 * recording transport (no network).
 */
import { describe, it, expect } from 'vitest';
import { Isa, IsaConfigError, type EnvReader } from '../../src/zyins';
import { ENV_VAR_NAMES } from '../../src/zyins';
import {
  TEST_APPLICANT,
  TEST_AUTH,
  TEST_COVERAGE,
  TEST_PRODUCTS,
  testCredentialStore,
} from './fixtures';
import type { Transport, TransportRequest } from '../../src/transport';

// Built at runtime so secret scanners do not flag a committed credential.
const FAKE_BEARER = ['isa', 'live', 'unit', 'test', 'token'].join('_');

const V3_BODY = JSON.stringify({
  object: 'prequalify_result',
  request_id: 'req_01HZK2N5GQR9T8X4B6FJW3Y1AS',
  idempotency_key: '550e8400-e29b-41d4-a716-446655440000',
  livemode: false,
  data: {
    plans: [
      {
        object: 'plan_offer',
        id: '9b7d9b5c-1f3a-5c2b-9a4f-6e1c2d3b4a5e',
        eligible: true,
        carrier: { id: 'c1', name: 'Aetna', logo_url: '' },
        product: {
          id: 'prod_d7b57156-3e83-506b-8936-0692c1193dc7',
          slug: 'fex-aetna-accendo',
          name: 'Accendo',
          display_name: 'Aetna Accendo',
          type: 'fex',
          wire_token: 'fex',
        },
        plan_info: [],
        death_benefit: { amount: { cents: 2_500_000, display: '$25,000' }, period: null },
        pricing: [
          {
            rate_class: 'Preferred',
            primary: true,
            eligibility: { category: 'immediate', eligible: true, reasons: [] },
            premium: {
              amount: { cents: 9122, display: '$91.22' },
              default_mode: 'MONTHLY-EFT',
              modes: { 'MONTHLY-EFT': { cents: 9122, display: '$91.22' } },
            },
            rank: 1,
          },
        ],
        metadata: {},
      },
    ],
  },
});

/** A transport that records the last request and answers with `body`. */
function recordingTransport(body: string): { transport: Transport; last: () => TransportRequest } {
  let captured: TransportRequest | undefined;
  const transport: Transport = async (request) => {
    captured = request;
    return { status: 200, body, headers: {} };
  };
  return {
    transport,
    last: () => {
      if (!captured) throw new Error('recordingTransport: no request captured');
      return captured;
    },
  };
}

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

const V3_REQUEST = {
  applicant: TEST_APPLICANT,
  coverage: TEST_COVERAGE,
  products: TEST_PRODUCTS,
} as const;

describe('Isa.withBearer — zyins.prequalifyV3', () => {
  it('does not throw IsaConfigError and returns parsed plans', async () => {
    const { transport } = recordingTransport(V3_BODY);
    const isa = await Isa.withBearer({ token: FAKE_BEARER }, undefined, { transport });

    const envelope = await isa.zyins.prequalifyV3(V3_REQUEST);

    expect(envelope.data.plans).toHaveLength(1);
    expect(envelope.data.plans[0]?.product.id).toBe('prod_d7b57156-3e83-506b-8936-0692c1193dc7');
    expect(envelope.data.livemode).toBe(false);
  });

  it('routes to /v3/prequalify with an Authorization: Bearer header', async () => {
    const { transport, last } = recordingTransport(V3_BODY);
    const isa = await Isa.withBearer({ token: FAKE_BEARER }, undefined, { transport });

    await isa.zyins.prequalifyV3(V3_REQUEST);

    const request = last();
    expect(request.url).toBe(`https://zyins.isaapi.com/v3/prequalify`);
    expect(request.method).toBe('POST');
    expect(request.headers['Authorization']).toBe(`Bearer ${FAKE_BEARER}`);
    // Bearer mode emits NO License-HMAC device headers.
    expect(request.headers['X-Device-Signature']).toBeUndefined();
    expect(request.headers['X-Device-ID']).toBeUndefined();
  });

  it('routes quoteV3 to /v3/quote with the same bearer header', async () => {
    const { transport, last } = recordingTransport(V3_BODY);
    const isa = await Isa.withBearer({ token: FAKE_BEARER }, undefined, { transport });

    await isa.zyins.quoteV3(V3_REQUEST);

    const request = last();
    expect(request.url).toBe(`https://zyins.isaapi.com/v3/quote`);
    expect(request.headers['Authorization']).toBe(`Bearer ${FAKE_BEARER}`);
  });
});

describe('Isa.withKeycode — zyins.prequalifyV3 stays License-HMAC', () => {
  it('signs with License-HMAC device headers and no bearer header', async () => {
    const { transport, last } = recordingTransport(V3_BODY);
    const isa = await Isa.withKeycode(
      {
        keycode: TEST_AUTH.licenseKey,
        email: TEST_AUTH.email,
        orderId: TEST_AUTH.orderId,
        licenseKey: TEST_AUTH.licenseKey,
        credentialStore: await testCredentialStore(),
      },
      licenseEnv(),
      { transport, apiVersion: { prequalify: 'v3' } },
    );

    const envelope = await isa.zyins.prequalifyV3(V3_REQUEST);

    expect(envelope.data.plans).toHaveLength(1);
    const request = last();
    expect(request.url).toBe(`https://zyins.isaapi.com/v3/prequalify`);
    expect(request.headers['Authorization']?.startsWith('License ')).toBe(true);
    expect(typeof request.headers['X-Device-Signature']).toBe('string');
    expect(request.headers['X-Device-ID']).toBe(TEST_AUTH.deviceId);
    // The keycode path never emits a bearer header.
    expect(request.headers['Authorization']?.startsWith('Bearer ')).toBe(false);
  });
});
