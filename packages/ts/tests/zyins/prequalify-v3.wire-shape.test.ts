/**
 * Wire-shape contract tests for `prequalifyV3` and `prequalifyV2`.
 *
 * Prod incident 2026-05-29: the v3 prequalify marshaler was emitting the
 * v2 flat shape (`date_of_birth`, `gender`, `height`, `weight` at the
 * root) against `POST /v3/prequalify`, which rejects unknown fields and
 * required the envelope shape from `PrequalifyV3Request`
 * (`applicant` + `coverage` + `products[]`).
 *
 * These tests pin the wire body to the OpenAPI source-of-truth schemas
 * in `go/zyins/api/openapi.yaml` so the bug cannot regress silently.
 *  - `prequalifyV3` MUST emit the v3 envelope, target `/v3/prequalify`,
 *    and carry `Api-Version: v3`.
 *  - `prequalifyV2` MUST emit the v2 flat shape and target
 *    `/v2/prequalify` — preserved untouched by the v3 fix.
 */

import { describe, expect, it } from 'vitest';
import { ZyInsClient } from '../../src/zyins/client';
import type { Transport, TransportRequest } from '../../src/zyins/transport';
import {
  TEST_APPLICANT,
  TEST_AUTH,
  TEST_COVERAGE,
  TEST_PRODUCTS,
  FIXED_CLOCK,
} from './fixtures';
import {
  type Applicant,
  Height,
  NicotineDuration,
  Sex,
  Weight,
} from '../../src/zyins/applicant';

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function parseBody(raw: string | undefined): Record<string, unknown> {
  const parsed: unknown = JSON.parse(raw ?? '{}');
  if (!isRecord(parsed)) throw new Error('Expected request body to parse to an object');
  return parsed;
}

function captureTransport(): { transport: Transport; captured: { req?: TransportRequest } } {
  const captured: { req?: TransportRequest } = {};
  const transport: Transport = async (req) => {
    captured.req = req;
    return {
      status: 200,
      body: JSON.stringify({
        object: 'prequalify_result',
        request_id: 'req_01HZK2N5GQR9T8X4B6FJW3Y1AS',
        idempotency_key: req.headers['Idempotency-Key'] ?? '',
        livemode: true,
        data: { plans: [] },
      }),
      headers: {},
    };
  };
  return { transport, captured };
}

describe('prequalifyV3 wire shape', () => {
  it('emits the v3 envelope — applicant + coverage + products — and POSTs to /v3/prequalify', async () => {
    const { transport, captured } = captureTransport();
    const client = new ZyInsClient({
      auth: TEST_AUTH,
      baseUrl: 'https://test.example',
      transport,
      clock: FIXED_CLOCK,
    });
    await client.prequalifyV3({
      applicant: TEST_APPLICANT,
      coverage: TEST_COVERAGE,
      products: TEST_PRODUCTS,
    });

    expect(captured.req?.url).toBe('https://test.example/v3/prequalify');
    expect(captured.req?.method).toBe('POST');
    expect(captured.req?.headers['Api-Version']).toBe('v3');

    const body = parseBody(captured.req?.body);

    // Envelope keys — must NOT carry the v2 flat fields.
    expect(Object.keys(body).sort()).toEqual(
      ['applicant', 'coverage', 'include_ineligible', 'products'].sort(),
    );
    expect(body).not.toHaveProperty('date_of_birth');
    expect(body).not.toHaveProperty('gender');
    expect(body).not.toHaveProperty('height');
    expect(body).not.toHaveProperty('weight');
    expect(body).not.toHaveProperty('nicotine_usage');
    expect(body).not.toHaveProperty('quote_options');

    // Applicant envelope per ApplicantV3Input.
    const applicant = body['applicant'];
    if (!isRecord(applicant)) throw new Error('applicant must be an object');
    expect(applicant['sex']).toBe('male');
    expect(applicant['dob']).toBe('1962-04-18');
    expect(applicant['height_inches']).toBe(70);
    expect(applicant['weight_lbs']).toBe(195);
    expect(applicant).not.toHaveProperty('gender');
    expect(applicant).not.toHaveProperty('date_of_birth');
    expect(applicant).not.toHaveProperty('height');
    expect(applicant).not.toHaveProperty('weight');
    expect(applicant).not.toHaveProperty('state'); // state lives on coverage in v3
    expect(applicant['nicotine']).toEqual({ last_used: 'never' });

    // Coverage envelope per CoverageV3Input — face_amount_cents + state.
    const coverage = body['coverage'];
    if (!isRecord(coverage)) throw new Error('coverage must be an object');
    // TEST_COVERAGE = Coverage.faceValue(100_000) → 10_000_000 cents.
    expect(coverage['face_amount_cents']).toBe(10_000_000);
    expect(coverage['state']).toBe('NC');

    // Products: flat slug list per the PrequalifyV3Request schema.
    expect(Array.isArray(body['products'])).toBe(true);
    expect((body['products'] as readonly unknown[]).length).toBeGreaterThan(0);
  });

  it('serializes conditions, medications, and nicotine specificity per the v3 schemas', async () => {
    const { transport, captured } = captureTransport();
    const applicant: Applicant = {
      dob: '1962-04-18',
      sex: Sex.Male,
      height: Height.fromFeetInches(5, 10),
      weight: Weight.fromPounds(195),
      state: 'NC',
      nicotineUse: {
        lastUsed: NicotineDuration.Within12Months,
        productUsage: [{ type: 'CIGARETTE', frequency: 'DAILY' }],
      },
      conditions: [
        { name: 'High Blood Pressure', wasDiagnosed: '5 YEARS AGO', lastTreatment: '2 MONTHS AGO' },
      ],
      medications: [
        { name: 'Lisinopril', use: 'High Blood Pressure', firstFill: '5 YEARS AGO', lastFill: '1 MONTH AGO' },
      ],
    };
    const client = new ZyInsClient({
      auth: TEST_AUTH,
      baseUrl: 'https://test.example',
      transport,
      clock: FIXED_CLOCK,
    });
    await client.prequalifyV3({
      applicant,
      coverage: TEST_COVERAGE,
      products: TEST_PRODUCTS,
    });

    const body = parseBody(captured.req?.body);
    const ap = body['applicant'];
    if (!isRecord(ap)) throw new Error('applicant must be an object');

    expect(ap['conditions']).toEqual([
      { text: 'High Blood Pressure', was_diagnosed: '5 YEARS AGO', last_treatment: '2 MONTHS AGO' },
    ]);
    expect(ap['medications']).toEqual([
      {
        text: 'Lisinopril',
        use: 'High Blood Pressure',
        first_fill: '5 YEARS AGO',
        last_fill: '1 MONTH AGO',
      },
    ]);
    expect(ap['nicotine']).toEqual({
      last_used: 'within_12_months',
      specificity: [{ text: 'CIGARETTE', frequency: 'daily' }],
    });
  });
});

describe('prequalifyV2 wire shape (regression guard)', () => {
  it('still emits the v2 flat shape against /v2/prequalify', async () => {
    const { transport, captured } = captureTransport();
    const client = new ZyInsClient({
      auth: TEST_AUTH,
      baseUrl: 'https://test.example',
      transport,
      clock: FIXED_CLOCK,
    });
    await client.prequalifyV2({
      applicant: TEST_APPLICANT,
      coverage: TEST_COVERAGE,
      products: TEST_PRODUCTS,
    });

    expect(captured.req?.url).toBe('https://test.example/v2/prequalify');
    expect(captured.req?.method).toBe('POST');

    const body = parseBody(captured.req?.body);
    // v2 flat fields MUST be present.
    expect(body['date_of_birth']).toBe('1962-04-18');
    expect(body['gender']).toBe('male');
    expect(body['height']).toBe(70);
    expect(body['weight']).toBe(195);
    expect(body['state']).toBe('NC');
    expect(body['nicotine_usage']).toEqual({ last_used: 'never' });
    expect(body['quote_options']).toBeDefined();
    // v3 envelope keys MUST NOT be present.
    expect(body).not.toHaveProperty('applicant');
    expect(body).not.toHaveProperty('coverage');
  });
});
