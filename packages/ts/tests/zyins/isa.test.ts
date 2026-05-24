/**
 * Phase 2 — envelope fields, .withRawResponse, and concurrency safety
 * (SDK_DESIGN §4.6, §5.4, §12).
 */
import { describe, it, expect } from 'vitest';
import {
  Isa,
  ENV_VAR_NAMES,
  IsaConfigError,
  type Envelope,
  type RawResponseResult,
  type EnvReader,
  type ZyInsClient,
  type CaseEmailRequest,
} from '../../src/zyins';
import { EmailFacade } from '../../src/zyins/isaNamespaces';
import { TEST_APPLICANT, TEST_AUTH, TEST_COVERAGE, TEST_PRODUCTS } from './fixtures';

// Fake bearer token built at runtime so static-analysis scanners don't flag
// it as a committed credential.
const FAKE_BEARER = ['isa', 'live', 'unit', 'test'].join('_');

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

async function buildIsa(
  opts: { transport?: import('../src/transport').Transport } = {},
): Promise<Isa> {
  const isa = await Isa.withKeycode(
    {
      keycode: TEST_AUTH.licenseKey,
      email: TEST_AUTH.email,
      deviceId: TEST_AUTH.deviceId,
      orderId: TEST_AUTH.orderId,
      licenseKey: TEST_AUTH.licenseKey,
    },
    licenseEnv(),
  );
  // Inject a recording transport via the underlying ZyInsClient — done by
  // poking the internal cached client. Done here only because Phase 1+2
  // does not yet introduce a public transport-injection point on Isa.
  // (Phase 3 will lift this when the unified transport lands.)
  if (opts.transport) {
    // Force lazy client construction then swap transport. We do this by
    // re-binding the operation context through reflection on the namespace.
    type Internal = {
      clientOnce: () => import('../src/client').ZyInsClient;
    };
    const ns = (isa.zyins as unknown) as Internal;
    const client = ns.clientOnce();
    (client as unknown as { transport: import('../src/transport').Transport }).transport =
      opts.transport;
  }
  return isa;
}

const OK_BODY = JSON.stringify({
  plans: [
    {
      brand: 'colonial-penn',
      tier: 'preferred',
      monthly_premium: 42,
      face_value: 100_000,
      product_token: 'colonial-penn.final-expense',
    },
  ],
  request_id: 'req_test_iso',
});

describe('Envelope<T>', () => {
  it('surfaces requestId, idempotencyKey, livemode, retryAttempts as named fields', async () => {
    const isa = await buildIsa({
      transport: async () => ({ status: 200, body: OK_BODY, headers: {} }),
    });
    const envelope: Envelope<{
      plans: ReadonlyArray<{ brand: string }>;
      requestId: string;
    }> = await isa.zyins.prequalify({
      applicant: TEST_APPLICANT,
      coverage: TEST_COVERAGE,
      products: TEST_PRODUCTS,
    });
    expect(envelope.data.plans[0]?.brand).toBe('colonial-penn');
    expect(envelope.requestId).toBe('req_test_iso');
    expect(typeof envelope.idempotencyKey).toBe('string');
    expect(typeof envelope.livemode).toBe('boolean');
    expect(typeof envelope.retryAttempts).toBe('number');
    expect(envelope.retryAttempts).toBe(0);
  });
});

describe('Isa.account namespace configuration', () => {
  it('defers non-license configuration errors until a method is called', async () => {
    const isa = await Isa.withBearer({ token: FAKE_BEARER });
    expect(() => isa.account.branding).not.toThrow();
    expect(() => isa.account.branding.lookup()).toThrow(IsaConfigError);
  });
});

describe('.withRawResponse variant (Phase 2 §5.4)', () => {
  it('returns { data, response } with status/headers/url', async () => {
    const isa = await buildIsa({
      transport: async () => ({ status: 200, body: OK_BODY, headers: { 'x-foo': 'bar' } }),
    });
    const raw: RawResponseResult<{
      plans: ReadonlyArray<{ brand: string }>;
      requestId: string;
    }> = await isa.zyins.prequalifyRaw({
      applicant: TEST_APPLICANT,
      coverage: TEST_COVERAGE,
      products: TEST_PRODUCTS,
    });
    expect(raw.data.plans[0]?.brand).toBe('colonial-penn');
    expect(raw.response.status).toBe(200);
    expect(typeof raw.response.headers).toBe('object');
    expect(typeof raw.response.url).toBe('string');
  });
});

// legacyBlob was removed in 0.5.1. The typed prequalify path is the only surface.

describe('Concurrency safety (Phase 2 §12)', () => {
  it('runs 100 parallel calls and returns 100 distinct request IDs', async () => {
    let counter = 0;
    const isa = await buildIsa({
      transport: async () => {
        const id = `req_par_${counter++}`;
        const body = JSON.stringify({ plans: [], request_id: id });
        return { status: 200, body, headers: {} };
      },
    });
    const results = await Promise.all(
      Array.from({ length: 100 }, () =>
        isa.zyins.prequalify({
          applicant: TEST_APPLICANT,
          coverage: TEST_COVERAGE,
          products: TEST_PRODUCTS,
        }),
      ),
    );
    const ids = results.map((e) => e.requestId);
    expect(ids).toHaveLength(100);
    expect(new Set(ids).size).toBe(100);
  });
});

describe('Isa.zyins.email', () => {
  it('routes enqueue through the cases sub-client', async () => {
    const request: CaseEmailRequest = {
      to: 'agent@example.com',
      subject: 'Case',
      bodyHtml: '<p>Case</p>',
      attachmentFilename: 'case.pdf',
      attachmentContent: 'pdf-bytes',
    };
    const facade = new EmailFacade(
      () =>
        ({
          case: {
            email: () => {
              throw new Error('legacy case sub-client used');
            },
          },
          cases: {
            email: async (actual: CaseEmailRequest) => {
              expect(actual).toBe(request);
              return { enqueueId: 'eq_1' };
            },
          },
        }) as unknown as ZyInsClient,
    );

    await expect(facade.enqueue(request)).resolves.toEqual({ enqueueId: 'eq_1' });
  });
});
