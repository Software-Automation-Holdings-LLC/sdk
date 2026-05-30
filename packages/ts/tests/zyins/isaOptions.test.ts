/**
 * Tests for the typed `Isa.create({ ... })` options-bag constructor and
 * the v2-native default contract introduced by this PR.
 *
 * Covers:
 *  - `IsaCreateOptions` parsing + default resolution (`apiVersion: 'v2'`,
 *    `engine: RemoteEngine.default`, `timeout: 30000`).
 *  - `apiVersion` routing — v2 default aliases `prequalify` to v2; v1
 *    aliases to v1 and emits the legacy envelope shape.
 *  - Typed `plan_info` array wire shape (post-zyins#349) is preserved
 *    verbatim, including server-supplied labels.
 *  - Legacy `Record<string, string[]>` wire bodies are upconverted to the
 *    typed array shape and a legacy mirror is populated for the
 *    migration window.
 *  - Engine abstraction — `RemoteEngine` / `LocalEngine` / `InMemoryEngine`
 *    expose the same product API surface.
 *  - `Api-Version` header pin on every product call.
 *  - 409 idempotency_conflict auto-retry with a freshly-minted UUID v4 key.
 *  - Backward-compat: existing `Isa.withKeycode(...)` keeps working.
 */

import { describe, it, expect } from 'vitest';
import {
  Isa,
  BearerAuth,
  LicenseAuth,
  RemoteEngine,
  LocalEngine,
  InMemoryEngine,
  IsaConfigError,
  IsaTimeoutError,
  inMemoryEngineWith,
  resolveIsaOptions,
  DEFAULT_TIMEOUT_MS,
  type IsaCreateOptions,
  type Transport,
  type TransportRequest,
  ENV_VAR_NAMES,
  type EnvReader,
} from '../../src/zyins';
import { TEST_APPLICANT, TEST_AUTH, TEST_COVERAGE, TEST_PRODUCTS } from './fixtures';

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

const V2_BODY = JSON.stringify({
  object: 'prequalify_result',
  request_id: 'req_01HZK2N5GQR9T8X4B6FJW3Y1AS',
  idempotency_key: '550e8400-e29b-41d4-a716-446655440000',
  livemode: true,
  data: {
    plans: [
      {
        object: 'plan_offer',
        id: '9b7d9b5c-1f3a-5c2b-9a4f-6e1c2d3b4a5e',
        result_index: 0,
        rank: 1,
        eligibility: { eligible: true, category: 'immediate', coverage_tier: null, reasons: [] },
        carrier: { id: 'c1', name: 'American Amicable', logo_url: '' },
        product: {
          id: 'p1',
          slug: 'american-amicable-golden-solution',
          name: 'Golden Solution',
          display_name: 'American Amicable Golden Solution',
          type: 'fex',
          wire_token: 'fex',
        },
        // Post-zyins#349 wire shape: typed array.
        plan_info: [
          { key: 'eapp', label: 'eApp', values: ['https://example.com'] },
          { key: 'telesales', label: 'Telesales', values: ['Required'] },
        ],
        death_benefit: { cents: 1500000, display: '$15,000.00' },
        premium: {
          cents: 12240,
          display: '$122.40',
          mode: 'MONTHLY-EFT',
          rate_class: 'graded',
          modes: { 'MONTHLY-EFT': { cents: 12240, display: '$122.40' } },
        },
        other_offers: [],
        metadata: {},
      },
    ],
    has_more: false,
    next_cursor: null,
  },
});

const V2_BODY_LEGACY_PLAN_INFO = JSON.stringify({
  object: 'prequalify_result',
  request_id: 'req_01HZK2N5GQR9T8X4B6FJW3Y1AS',
  idempotency_key: '550e8400-e29b-41d4-a716-446655440000',
  livemode: true,
  data: {
    plans: [
      {
        object: 'plan_offer',
        id: '9b7d9b5c-1f3a-5c2b-9a4f-6e1c2d3b4a5e',
        result_index: 0,
        rank: 1,
        eligibility: { eligible: true, category: 'immediate', coverage_tier: null, reasons: [] },
        carrier: { id: 'c1', name: 'American Amicable', logo_url: '' },
        product: {
          id: 'p1',
          slug: 'aa-golden',
          name: 'Golden Solution',
          display_name: 'AA Golden',
          type: 'fex',
          wire_token: 'fex',
        },
        // Pre-zyins#349 wire shape: legacy map.
        plan_info: {
          eapp: ['https://example.com'],
          telesales: ['Required'],
        },
        death_benefit: { cents: 1500000, display: '$15,000.00' },
        premium: null,
        other_offers: [],
        metadata: {},
      },
    ],
    has_more: false,
    next_cursor: null,
  },
});

const V1_BODY = JSON.stringify({
  data: {
    meta: {
      amounts: ['100000'],
      processing_time_ms: 25,
      quote_type: 'face_amounts',
      total_products: 1,
    },
    results: {
      '100000': [
        {
          brand: 'colonial-penn',
          name: 'Colonial Penn',
          plan: 'PREFERRED',
          plan_group: null,
          death_benefit: 100000,
          monthly_price: '$42.00',
          default_pricing_key: 'MONTHLY',
          id: 'fex-colonial-penn',
          index: 0,
          is_excluded: false,
          logo_url: '',
          plan_info: { brochure: ['https://example.com'] },
        },
      ],
    },
  },
  request_id: 'req_v1_test',
  idempotency_key: 'idem_v1_test',
});

const CONFLICT_BODY = JSON.stringify({
  code: 'idempotency_conflict',
  message: 'idempotency key collision',
});
const CASE_VIEWER_BASE_URL = 'https://viewer.test';
const CASE_ID = '9f1c2d3e-4b5a-6c7d-8e9f-0a1b2c3d4e5f';

async function buildIsaWithCreate(opts: IsaCreateOptions): Promise<Isa> {
  return Isa.create(opts);
}

describe('resolveIsaOptions', () => {
  it('applies the documented defaults', () => {
    const resolved = resolveIsaOptions({ auth: BearerAuth.fromToken('isa_live_xyz') });
    expect(resolved.apiVersions.prequalify).toBe('v2');
    expect(resolved.apiVersions.cases).toBe('v1');
    expect(resolved.engine.kind).toBe('remote');
    expect(resolved.timeoutMs).toBe(DEFAULT_TIMEOUT_MS);
    expect(resolved.baseUrl).toBe('https://zyins.isaapi.com');
  });

  it('honors LocalEngine.at(...) for the resolved baseUrl', () => {
    const resolved = resolveIsaOptions({
      auth: BearerAuth.fromToken('isa_live_xyz'),
      engine: LocalEngine.at('http://127.0.0.1:8080'),
    });
    expect(resolved.engine.kind).toBe('local');
    expect(resolved.baseUrl).toBe('http://127.0.0.1:8080');
  });

  it('honors apiVersion: { prequalify: "v1" } override', () => {
    const resolved = resolveIsaOptions({
      auth: BearerAuth.fromToken('isa_live_xyz'),
      apiVersion: { prequalify: 'v1' },
    });
    expect(resolved.apiVersions.prequalify).toBe('v1');
    // Unset surfaces fall back to the bundled default.
    expect(resolved.apiVersions.quote).toBe('v2');
  });

  it('honors caseViewerBaseUrl for share-link construction', () => {
    const resolved = resolveIsaOptions({
      auth: BearerAuth.fromToken('isa_live_xyz'),
      caseViewerBaseUrl: CASE_VIEWER_BASE_URL,
    });
    expect(resolved.caseViewerBaseUrl).toBe(CASE_VIEWER_BASE_URL);
  });

  it('applies transport overrides after in-memory engine selection', () => {
    const { transport } = recordingTransport({ status: 200, body: V2_BODY });
    const resolved = resolveIsaOptions({
      auth: BearerAuth.fromToken('isa_live_xyz'),
      engine: InMemoryEngine,
      transport,
    });
    expect(resolved.transport).toBe(transport);
  });
});

describe('Isa.create — IsaOptions sugar constructor', () => {
  it('binds prequalify to v2 by default and pins Api-Version header', async () => {
    const { transport, calls } = recordingTransport({ status: 200, body: V2_BODY });
    const isa = await Isa.withKeycode(
      {
        keycode: TEST_AUTH.licenseKey,
        email: TEST_AUTH.email,
        orderId: TEST_AUTH.orderId,
        licenseKey: TEST_AUTH.licenseKey,
        transport,
      },
      licenseEnv(),
    );

    expect(isa.apiVersion.prequalify).toBe('v2');

    const envelope = await isa.zyins.prequalify({
      applicant: TEST_APPLICANT,
      coverage: TEST_COVERAGE,
      products: TEST_PRODUCTS,
    });

    // v2 envelope shape — plans is an array of PlanOffer.
    expect('plans' in envelope.data).toBe(true);
    const plans = (envelope.data as { plans: ReadonlyArray<{ carrier: { name: string } }> }).plans;
    expect(plans[0]?.carrier.name).toBe('American Amicable');

    expect(calls).toHaveLength(1);
    expect(calls[0]!.request.url).toContain('/v2/prequalify');
    expect(calls[0]!.request.headers['Api-Version']).toBe('v2');
  });

  it('rejects version-specific prequalify calls on mismatched clients', async () => {
    const { transport, calls } = recordingTransport({ status: 200, body: V2_BODY });
    const isa = await Isa.create({
      auth: LicenseAuth.fromKeycode(TEST_AUTH.licenseKey, TEST_AUTH.email, {
        orderId: TEST_AUTH.orderId,
        licenseKey: TEST_AUTH.licenseKey,
      }),
      engine: inMemoryEngineWith(transport),
    });

    const result = isa.zyins.prequalifyV1({
      applicant: TEST_APPLICANT,
      coverage: TEST_COVERAGE,
      products: TEST_PRODUCTS,
    });
    await expect(result).rejects.toBeInstanceOf(IsaConfigError);
    expect(calls).toHaveLength(0);

    const v1 = await Isa.create({
      auth: LicenseAuth.fromKeycode(TEST_AUTH.licenseKey, TEST_AUTH.email, {
        orderId: TEST_AUTH.orderId,
        licenseKey: TEST_AUTH.licenseKey,
      }),
      apiVersion: { prequalify: 'v1' },
      engine: inMemoryEngineWith(transport),
    });
    const v1Result = v1.zyins.prequalifyV2({
      applicant: TEST_APPLICANT,
      coverage: TEST_COVERAGE,
      products: TEST_PRODUCTS,
    });
    await expect(v1Result).rejects.toBeInstanceOf(IsaConfigError);
    expect(calls).toHaveLength(0);
  });

  it('times out product calls using the resolved timeout option', async () => {
    let signal: AbortSignal | undefined;
    const transport: Transport = async (request) => {
      signal = request.signal;
      return new Promise(() => {});
    };
    const isa = await Isa.create({
      auth: LicenseAuth.fromKeycode(TEST_AUTH.licenseKey, TEST_AUTH.email, {
        orderId: TEST_AUTH.orderId,
        licenseKey: TEST_AUTH.licenseKey,
      }),
      engine: inMemoryEngineWith(transport),
      timeout: 1,
    });

    const result = isa.zyins.prequalifyV2({
      applicant: TEST_APPLICANT,
      coverage: TEST_COVERAGE,
      products: TEST_PRODUCTS,
    });
    await expect(result).rejects.toBeInstanceOf(IsaTimeoutError);
    await expect(result).rejects.toThrow('timed out');
    expect(signal?.aborted).toBe(true);
  });

  it('routes to /v1/prequalify when apiVersion: "v1" is requested', async () => {
    const { transport, calls } = recordingTransport({ status: 200, body: V1_BODY });
    const isa = await Isa.create({
      auth: LicenseAuth.fromKeycode(TEST_AUTH.licenseKey, TEST_AUTH.email, {
        orderId: TEST_AUTH.orderId,
        licenseKey: TEST_AUTH.licenseKey,
      }),
      apiVersion: { prequalify: 'v1' },
      engine: inMemoryEngineWith(transport),
    });

    expect(isa.apiVersion.prequalify).toBe('v1');

    await isa.zyins.prequalify({
      applicant: TEST_APPLICANT,
      coverage: TEST_COVERAGE,
      products: TEST_PRODUCTS,
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]!.request.url).toContain('/v1/prequalify');
    expect(calls[0]!.request.headers['Api-Version']).toBe('v1');
  });

  it('passes caseViewerBaseUrl through to account cases', async () => {
    const { transport } = recordingTransport({
      status: 201,
      body: JSON.stringify({ object: 'case', id: CASE_ID }),
    });
    const isa = await Isa.create({
      auth: LicenseAuth.fromKeycode(TEST_AUTH.licenseKey, TEST_AUTH.email, {
        orderId: TEST_AUTH.orderId,
        licenseKey: TEST_AUTH.licenseKey,
      }),
      caseViewerBaseUrl: CASE_VIEWER_BASE_URL,
      engine: inMemoryEngineWith(transport),
    });

    const result = await isa.account.cases.create({
      product: 'zyins',
      payload: { applicant: { state: 'TX' } },
    });

    const expectedLinkPrefix = `${CASE_VIEWER_BASE_URL}/c/${CASE_ID}#k=`;
    expect(result.link.startsWith(expectedLinkPrefix)).toBe(true);
  });
});

describe('Plan.planInfo typed array surface', () => {
  it('preserves typed array verbatim from a post-#349 wire body', async () => {
    const { transport } = recordingTransport({ status: 200, body: V2_BODY });
    const isa = await Isa.create({
      auth: LicenseAuth.fromKeycode(TEST_AUTH.licenseKey, TEST_AUTH.email, {
        orderId: TEST_AUTH.orderId,
        licenseKey: TEST_AUTH.licenseKey,
      }),
      engine: inMemoryEngineWith(transport),
    });

    const envelope = await isa.zyins.prequalifyV2({
      applicant: TEST_APPLICANT,
      coverage: TEST_COVERAGE,
      products: TEST_PRODUCTS,
    });

    const offer = envelope.data.plans[0]!;
    expect(offer.plan_info).toHaveLength(2);
    expect(offer.plan_info[0]).toEqual({
      key: 'eapp',
      label: 'eApp',
      values: ['https://example.com'],
    });
    expect(offer.plan_info[1]).toEqual({
      key: 'telesales',
      label: 'Telesales',
      values: ['Required'],
    });
    expect(offer.plan_info_legacy).toBeUndefined();
  });

  it('upconverts a legacy map wire body to the typed array shape', async () => {
    const { transport } = recordingTransport({
      status: 200,
      body: V2_BODY_LEGACY_PLAN_INFO,
    });
    const isa = await Isa.create({
      auth: LicenseAuth.fromKeycode(TEST_AUTH.licenseKey, TEST_AUTH.email, {
        orderId: TEST_AUTH.orderId,
        licenseKey: TEST_AUTH.licenseKey,
      }),
      engine: inMemoryEngineWith(transport),
    });

    const envelope = await isa.zyins.prequalifyV2({
      applicant: TEST_APPLICANT,
      coverage: TEST_COVERAGE,
      products: TEST_PRODUCTS,
    });

    const offer = envelope.data.plans[0]!;
    expect(offer.plan_info).toHaveLength(2);
    const eapp = offer.plan_info.find((item) => item.key === 'eapp');
    expect(eapp?.label).toBe('eApp');
    expect(eapp?.values).toEqual(['https://example.com']);
    // Legacy mirror still available during the migration window.
    expect(offer.plan_info_legacy?.['eapp']).toEqual(['https://example.com']);
  });

  it('upconverts v1 legacy map to typed array on Plan.planInfo', async () => {
    const { transport } = recordingTransport({ status: 200, body: V1_BODY });
    const isa = await Isa.create({
      auth: LicenseAuth.fromKeycode(TEST_AUTH.licenseKey, TEST_AUTH.email, {
        orderId: TEST_AUTH.orderId,
        licenseKey: TEST_AUTH.licenseKey,
      }),
      apiVersion: { prequalify: 'v1' },
      engine: inMemoryEngineWith(transport),
    });

    const envelope = await isa.zyins.prequalifyV1({
      applicant: TEST_APPLICANT,
      coverage: TEST_COVERAGE,
      products: TEST_PRODUCTS,
    });
    expect(envelope.data.kind).toBe('single');
    if (envelope.data.kind !== 'single') return;
    const plan = envelope.data.plans[0]!;
    expect(Array.isArray(plan.planInfo)).toBe(true);
    expect(plan.planInfo).toHaveLength(1);
    expect(plan.planInfo[0]).toEqual({
      key: 'brochure',
      label: 'Brochure',
      values: ['https://example.com'],
    });
    expect(plan.planInfoLegacy?.['brochure']).toEqual(['https://example.com']);
  });
});

describe('409 idempotency_conflict self-heal', () => {
  it('retries once with a fresh idempotency key when the server replies 409 idempotency_conflict', async () => {
    const responses = [
      { status: 409, body: CONFLICT_BODY },
      { status: 200, body: V2_BODY },
    ];
    const calls: CapturedCall[] = [];
    const transport: Transport = async (request) => {
      calls.push({ request });
      const next = responses.shift();
      if (!next) throw new Error('Unexpected extra request');
      return { ...next, headers: {} };
    };

    const isa = await Isa.create({
      auth: LicenseAuth.fromKeycode(TEST_AUTH.licenseKey, TEST_AUTH.email, {
        orderId: TEST_AUTH.orderId,
        licenseKey: TEST_AUTH.licenseKey,
      }),
      engine: inMemoryEngineWith(transport),
    });

    const envelope = await isa.zyins.prequalifyV2({
      applicant: TEST_APPLICANT,
      coverage: TEST_COVERAGE,
      products: TEST_PRODUCTS,
    });

    expect(calls).toHaveLength(2);
    const firstKey = calls[0]!.request.headers['Idempotency-Key'];
    const secondKey = calls[1]!.request.headers['Idempotency-Key'];
    expect(firstKey).toBeDefined();
    expect(secondKey).toBeDefined();
    expect(secondKey).not.toBe(firstKey);
    expect(envelope.retryAttempts).toBe(1);
    // Body identical across attempts — only the key rotates.
    expect(calls[1]!.request.body).toBe(calls[0]!.request.body);
  });
});

describe('backward compatibility', () => {
  it('Isa.withKeycode(...) constructor still works with default v2 routing', async () => {
    const { transport, calls } = recordingTransport({ status: 200, body: V2_BODY });
    const isa = await Isa.withKeycode(
      {
        keycode: TEST_AUTH.licenseKey,
        email: TEST_AUTH.email,
        orderId: TEST_AUTH.orderId,
        licenseKey: TEST_AUTH.licenseKey,
        transport,
      },
      licenseEnv(),
    );

    expect(isa.apiVersion.prequalify).toBe('v2');

    await isa.zyins.prequalify({
      applicant: TEST_APPLICANT,
      coverage: TEST_COVERAGE,
      products: TEST_PRODUCTS,
    });

    expect(calls[0]!.request.url).toContain('/v2/prequalify');
  });

  it('exposes prequalifyV2 as a back-compat alias of the v2 callable', async () => {
    const { transport } = recordingTransport({ status: 200, body: V2_BODY });
    const isa = await Isa.create({
      auth: LicenseAuth.fromKeycode(TEST_AUTH.licenseKey, TEST_AUTH.email, {
        orderId: TEST_AUTH.orderId,
        licenseKey: TEST_AUTH.licenseKey,
      }),
      engine: inMemoryEngineWith(transport),
    });

    // Both should produce a v2 envelope.
    const a = await isa.zyins.prequalify({
      applicant: TEST_APPLICANT,
      coverage: TEST_COVERAGE,
      products: TEST_PRODUCTS,
    });
    const b = await isa.zyins.prequalifyV2({
      applicant: TEST_APPLICANT,
      coverage: TEST_COVERAGE,
      products: TEST_PRODUCTS,
    });
    expect(a.data.plans[0]?.carrier.name).toBe('American Amicable');
    expect(b.data.plans[0]?.carrier.name).toBe('American Amicable');
  });
});

describe('Engine abstraction', () => {
  it('RemoteEngine.default points at the production endpoint', () => {
    expect(RemoteEngine.default.kind).toBe('remote');
  });

  it('LocalEngine.at(...) builds a local engine descriptor', () => {
    const engine = LocalEngine.at('http://127.0.0.1:9000');
    expect(engine.kind).toBe('local');
  });

  it('InMemoryEngine fails closed unless a transport is injected', async () => {
    expect(InMemoryEngine.kind).toBe('in_memory');
    await expect(InMemoryEngine.transport({ url: '', method: 'GET', headers: {}, body: '' }))
      .rejects.toThrow('requires inMemoryEngineWith');
  });

  it('inMemoryEngineWith carries a transport and uses it for product calls', async () => {
    const { transport, calls } = recordingTransport({ status: 200, body: V2_BODY });
    const isa = await Isa.create({
      auth: LicenseAuth.fromKeycode(TEST_AUTH.licenseKey, TEST_AUTH.email, {
        orderId: TEST_AUTH.orderId,
        licenseKey: TEST_AUTH.licenseKey,
      }),
      engine: inMemoryEngineWith(transport),
    });
    await isa.zyins.prequalifyV2({
      applicant: TEST_APPLICANT,
      coverage: TEST_COVERAGE,
      products: TEST_PRODUCTS,
    });
    expect(calls).toHaveLength(1);
  });
});
