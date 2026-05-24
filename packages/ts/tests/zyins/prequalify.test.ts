import { describe, expect, it } from 'vitest';
import { ZyInsClient } from '../../src/zyins/client';
import type { Transport, TransportRequest } from '../../src/zyins/transport';
import { PrequalifyError, RateLimitedError } from '../../src/zyins/errors';
import { NicotineDuration, Height, Weight, Sex } from '../../src/zyins/applicant';
import { Coverage } from '../../src/zyins/coverage';
import { ProductCatalog, ProductSelection, ProductType } from '../../src/zyins/product';
import {
  TEST_APPLICANT,
  TEST_AUTH,
  TEST_COVERAGE,
  TEST_PRODUCTS,
  FIXED_CLOCK,
} from './fixtures';

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

describe('ZyInsClient.prequalify', () => {
  it('hits /v1/prequalify with the License HMAC headers', async () => {
    const { transport, calls } = recordingTransport({
      status: 200,
      body: JSON.stringify({data:{meta:{amounts:["100000"],processing_time_ms:25,quote_type:"face_amounts",total_products:1},results:{"100000":[{brand:"colonial-penn",name:"Colonial Penn",plan:"PREFERRED",plan_group:null,death_benefit:100000,monthly_price:"$42.00",default_pricing_key:"MONTHLY",id:"fex-colonial-penn",index:0,is_excluded:false,logo_url:"",plan_info:{}}]}},request_id:"req_test_1",idempotency_key:"idem_1"}),
    });
    const client = new ZyInsClient({
      auth: TEST_AUTH,
      baseUrl: 'https://test.example',
      transport,
      clock: FIXED_CLOCK,
    });
    const result = await client.prequalify({
      applicant: TEST_APPLICANT,
      coverage: TEST_COVERAGE,
      products: TEST_PRODUCTS,
    });
    expect(result.plans).toHaveLength(1);
    expect(result.plans[0]?.brand).toBe('colonial-penn');
    expect(result.requestId).toBe('req_test_1');
    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    expect(call.request.url).toBe('https://test.example/v1/prequalify');
    expect(call.request.method).toBe('POST');
    expect(call.request.headers['X-Device-ID']).toBe('device-xyz-123');
    expect(call.request.headers['Authorization']).toMatch(/^License /);
    expect(call.request.headers['Idempotency-Key']).toMatch(/^[0-9a-f]{64}$/);
  });

  it('derives a stable idempotency key for the same logical request', async () => {
    const { transport: t1, calls: c1 } = recordingTransport({
      status: 200,
      body: JSON.stringify({ plans: [], request_id: 'r1' }),
    });
    const client1 = new ZyInsClient({
      auth: TEST_AUTH,
      baseUrl: 'https://test.example',
      transport: t1,
      clock: FIXED_CLOCK,
    });
    await client1.prequalify({
      applicant: TEST_APPLICANT,
      coverage: TEST_COVERAGE,
      products: TEST_PRODUCTS,
    });
    const { transport: t2, calls: c2 } = recordingTransport({
      status: 200,
      body: JSON.stringify({ plans: [], request_id: 'r2' }),
    });
    const client2 = new ZyInsClient({
      auth: TEST_AUTH,
      baseUrl: 'https://test.example',
      transport: t2,
      clock: FIXED_CLOCK,
    });
    await client2.prequalify({
      applicant: TEST_APPLICANT,
      coverage: TEST_COVERAGE,
      products: TEST_PRODUCTS,
    });
    expect(c1[0]!.request.headers['Idempotency-Key']).toBe(
      c2[0]!.request.headers['Idempotency-Key'],
    );
  });

  it('maps ProblemDetails 400 to PrequalifyError(validation_error)', async () => {
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
      client.prequalify({
        applicant: TEST_APPLICANT,
        coverage: TEST_COVERAGE,
        products: TEST_PRODUCTS,
      }),
    ).rejects.toBeInstanceOf(PrequalifyError);
  });

  it('maps 429 to RateLimitedError', async () => {
    const { transport } = recordingTransport({ status: 429, body: 'slow down' });
    const client = new ZyInsClient({
      auth: TEST_AUTH,
      baseUrl: 'https://test.example',
      transport,
      clock: FIXED_CLOCK,
    });
    await expect(
      client.prequalify({
        applicant: TEST_APPLICANT,
        coverage: TEST_COVERAGE,
        products: TEST_PRODUCTS,
      }),
    ).rejects.toBeInstanceOf(RateLimitedError);
  });
});

// ---------------------------------------------------------------------------
// Wire-shape conformance
//
// Persona: John Doe, DOB 1962-04-18, NC, 5'10" 195 lbs, never-smoker.
// Asserts the exact flat JSON body the SDK emits to /v1/prequalify so the
// wire contract is explicit and any regression is immediately visible.
// ---------------------------------------------------------------------------

const parseBody = (s: string): unknown => JSON.parse(s);
const asRecord = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};

describe('prequalify wire body — flat schema conformance', () => {
  const JOHN_DOE_WIRE: Record<string, unknown> = {
    date_of_birth: '1962-04-18',
    gender: 'male',
    height: 70,
    weight: 195,
    state: 'NC',
    nicotine_usage: { last_used: 'never' },
    // TEST_PRODUCTS uses Products.Fex.AetnaAccendo from the v053 catalog
    // (type-prefixed wireToken). Update this fixture if TEST_PRODUCTS changes.
    products: ['fex-aetna-accendo'],
    conditions: [],
    medications: [],
    quote_options: { amounts: ['100000'], quote_type: 'face_amounts' },
  };

  it('emits the exact flat wire body for John Doe NC face-value fixture', async () => {
    const { transport, calls } = recordingTransport({
      status: 200,
      body: JSON.stringify({ plans: [], request_id: 'req_wire_shape_1' }),
    });
    const client = new ZyInsClient({ auth: TEST_AUTH, baseUrl: 'https://test.example', transport, clock: FIXED_CLOCK });
    await client.prequalify({ applicant: TEST_APPLICANT, coverage: TEST_COVERAGE, products: TEST_PRODUCTS });
    expect(parseBody(calls[0]!.request.body)).toEqual(JOHN_DOE_WIRE);
  });

  it('does NOT include license_key, order_id, or email in the body', async () => {
    const { transport, calls } = recordingTransport({
      status: 200,
      body: JSON.stringify({ plans: [], request_id: 'req_no_creds' }),
    });
    const client = new ZyInsClient({ auth: TEST_AUTH, baseUrl: 'https://test.example', transport, clock: FIXED_CLOCK });
    await client.prequalify({ applicant: TEST_APPLICANT, coverage: TEST_COVERAGE, products: TEST_PRODUCTS });
    const body = asRecord(parseBody(calls[0]!.request.body));
    expect(body).not.toHaveProperty('license_key');
    expect(body).not.toHaveProperty('order_id');
    expect(body).not.toHaveProperty('email');
  });

  it('emits products as string[] not a joined string', async () => {
    const { transport, calls } = recordingTransport({
      status: 200,
      body: JSON.stringify({ plans: [], request_id: 'req_products_array' }),
    });
    const client = new ZyInsClient({ auth: TEST_AUTH, baseUrl: 'https://test.example', transport, clock: FIXED_CLOCK });
    await client.prequalify({ applicant: TEST_APPLICANT, coverage: TEST_COVERAGE, products: TEST_PRODUCTS });
    expect(Array.isArray(asRecord(parseBody(calls[0]!.request.body))['products'])).toBe(true);
  });

  it('emits monthly_budget quote_options correctly', async () => {
    const { transport, calls } = recordingTransport({
      status: 200,
      body: JSON.stringify({ plans: [], request_id: 'req_budget' }),
    });
    const client = new ZyInsClient({ auth: TEST_AUTH, baseUrl: 'https://test.example', transport, clock: FIXED_CLOCK });
    await client.prequalify({ applicant: TEST_APPLICANT, coverage: Coverage.monthlyBudget(50), products: TEST_PRODUCTS });
    const opts = asRecord(asRecord(parseBody(calls[0]!.request.body))['quote_options']);
    expect(opts['quote_type']).toBe('monthly_budget');
    expect(opts['amounts']).toEqual(['50']);
  });

  it('maps NicotineDuration.Within12Months with product_usage onto the wire', async () => {
    const { transport, calls } = recordingTransport({
      status: 200,
      body: JSON.stringify({ plans: [], request_id: 'req_nicotine' }),
    });
    const client = new ZyInsClient({ auth: TEST_AUTH, baseUrl: 'https://test.example', transport, clock: FIXED_CLOCK });
    await client.prequalify({
      applicant: { ...TEST_APPLICANT, nicotineUse: { lastUsed: NicotineDuration.Within12Months, productUsage: [{ type: 'CIGARETTE', frequency: 'DAILY' }] } },
      coverage: TEST_COVERAGE,
      products: TEST_PRODUCTS,
    });
    const nu = asRecord(asRecord(parseBody(calls[0]!.request.body))['nicotine_usage']);
    expect(nu['last_used']).toBe('within_12_months');
    expect(nu['product_usage']).toEqual([{ type: 'CIGARETTE', frequency: 'DAILY' }]);
  });

  it('includes zip when present and omits it when absent', async () => {
    const { transport: t1, calls: c1 } = recordingTransport({ status: 200, body: JSON.stringify({ plans: [], request_id: 'req_zip' }) });
    const client1 = new ZyInsClient({ auth: TEST_AUTH, baseUrl: 'https://test.example', transport: t1, clock: FIXED_CLOCK });
    await client1.prequalify({ applicant: { ...TEST_APPLICANT, zip: '27545' }, coverage: TEST_COVERAGE, products: TEST_PRODUCTS });
    expect(asRecord(parseBody(c1[0]!.request.body))['zip']).toBe('27545');

    const { transport: t2, calls: c2 } = recordingTransport({ status: 200, body: JSON.stringify({ plans: [], request_id: 'req_nozip' }) });
    const client2 = new ZyInsClient({ auth: TEST_AUTH, baseUrl: 'https://test.example', transport: t2, clock: FIXED_CLOCK });
    await client2.prequalify({ applicant: TEST_APPLICANT, coverage: TEST_COVERAGE, products: TEST_PRODUCTS });
    expect(asRecord(parseBody(c2[0]!.request.body))).not.toHaveProperty('zip');
  });
});
