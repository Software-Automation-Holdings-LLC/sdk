/**
 * Tests for the `CaseStorage` adapter surface and the default
 * `ZeroKnowledgeCaseStorage` round-trip behavior.
 *
 * Covers:
 *  - Default Zero-Knowledge adapter: save → recall returns the identical
 *    record, ciphertext goes on the wire, key never does.
 *  - Caller-supplied override: an in-memory adapter is called instead of
 *    the default; no `/v1/case` request is issued.
 */

import { describe, it, expect } from 'vitest';
import {
  Isa,
  LicenseAuth,
  inMemoryEngineWith,
  type Transport,
  type TransportRequest,
  type TransportResponse,
} from '../../src/zyins';
import type {
  CaseRecord,
  CaseStorage,
  CaseStoragePutResult,
} from '../../src/zyins/cases/CaseStorage';
import { TEST_AUTH } from './fixtures';

const STUB_CASE_ID = '9f1c2d3e-4b5a-6c7d-8e9f-0a1b2c3d4e5f';

interface FakeServerHandle {
  readonly transport: Transport;
  readonly requests: TransportRequest[];
}

interface StoredEnvelope {
  product: string;
  ciphertext: string;
  iv: string;
  tag: string;
}

function isStoredEnvelope(value: unknown): value is StoredEnvelope {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj['product'] === 'string' &&
    typeof obj['ciphertext'] === 'string' &&
    typeof obj['iv'] === 'string' &&
    typeof obj['tag'] === 'string'
  );
}

/**
 * Minimal in-process `/v1/case` server that stores ciphertext by id so
 * `ZeroKnowledgeCaseStorage.put` followed by `.get` can complete an
 * encrypt/decrypt round-trip without a live HTTP layer.
 */
function fakeCaseServer(): FakeServerHandle {
  const store = new Map<string, StoredEnvelope>();
  const requests: TransportRequest[] = [];
  let nextId = 0;
  const transport: Transport = async (request): Promise<TransportResponse> => {
    requests.push(request);
    const path = new URL(request.url).pathname;
    if (request.method === 'POST' && path === '/v1/case') {
      const parsed: unknown = JSON.parse(request.body);
      if (!isStoredEnvelope(parsed)) {
        return { status: 400, body: '{"error":"bad envelope"}', headers: {} };
      }
      nextId += 1;
      const id = `${STUB_CASE_ID}-${nextId}`;
      store.set(id, parsed);
      return { status: 201, body: JSON.stringify({ id }), headers: {} };
    }
    if (request.method === 'GET' && path.startsWith('/v1/case/')) {
      const id = decodeURIComponent(path.substring('/v1/case/'.length));
      const record = store.get(id);
      if (!record) return { status: 404, body: '', headers: {} };
      return {
        status: 200,
        body: JSON.stringify(record),
        headers: {},
      };
    }
    return { status: 405, body: '', headers: {} };
  };
  return { transport, requests };
}

async function buildIsa(transport: Transport, extras: { caseStorage?: CaseStorage } = {}): Promise<Isa> {
  const opts: Parameters<typeof Isa.create>[0] = {
    auth: LicenseAuth.fromKeycode(TEST_AUTH.licenseKey, TEST_AUTH.email, {
      orderId: TEST_AUTH.orderId,
      licenseKey: TEST_AUTH.licenseKey,
    }),
    engine: inMemoryEngineWith(transport),
  };
  if (extras.caseStorage !== undefined) opts.caseStorage = extras.caseStorage;
  return Isa.create(opts);
}

describe('ZeroKnowledgeCaseStorage (default adapter)', () => {
  it('round-trips a record: save then recall returns the identical payload', async () => {
    const server = fakeCaseServer();
    const isa = await buildIsa(server.transport);

    const original: CaseRecord = {
      product: 'zyins',
      payload: {
        input: { applicant: { state: 'NC', dob: '1962-04-18' } },
        results: { ranked: ['colonial-penn'] },
      },
    };
    const { id, recallToken } = await isa.zyins.cases.save(original);
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
    expect(typeof recallToken).toBe('string');
    expect(recallToken!.length).toBeGreaterThan(0);

    const recovered = await isa.zyins.cases.recall(id, recallToken);
    expect(recovered).not.toBeNull();
    expect(recovered!.product).toBe(original.product);
    expect(recovered!.payload).toEqual(original.payload);
  });

  it('returns null for an unknown id (expired / never existed)', async () => {
    const server = fakeCaseServer();
    const isa = await buildIsa(server.transport);
    const result = await isa.zyins.cases.recall('does-not-exist', 'unused-but-required-token');
    expect(result).toBeNull();
  });

  it('sends only ciphertext + iv + tag on the wire (the key never leaves)', async () => {
    const server = fakeCaseServer();
    const isa = await buildIsa(server.transport);

    const { recallToken } = await isa.zyins.cases.save({
      product: 'zyins',
      payload: { input: { state: 'NC' } },
    });

    const post = server.requests.find((r) => r.method === 'POST' && r.url.includes('/v1/case'))!;
    expect(post.body).not.toContain(recallToken!);
    expect(post.body).toContain('"ciphertext"');
    expect(post.body).toContain('"iv"');
    expect(post.body).toContain('"tag"');
    expect(post.body).not.toContain('"key"');
  });
});

describe('Caller-supplied CaseStorage override', () => {
  it('routes save/recall through the override; no /v1/case request is issued', async () => {
    const server = fakeCaseServer();
    const memoryStore = new Map<string, CaseRecord>();
    let nextStubId = 0;
    const stubStorage: CaseStorage = {
      async put(record) {
        nextStubId += 1;
        const id = `stub-${nextStubId}`;
        memoryStore.set(id, record);
        return { id };
      },
      async get(id) {
        return memoryStore.get(id) ?? null;
      },
    };

    const isa = await buildIsa(server.transport, { caseStorage: stubStorage });

    const original: CaseRecord = { product: 'zyins', payload: { input: { state: 'TX' } } };
    const put: CaseStoragePutResult = await isa.zyins.cases.save(original);
    expect(put.id).toBe('stub-1');
    expect(put.recallToken).toBeUndefined();

    const recovered = await isa.zyins.cases.recall(put.id);
    expect(recovered).toEqual(original);

    // The stub stored everything locally — ISA's /v1/case was never hit.
    const caseHits = server.requests.filter((r) => r.url.includes('/v1/case'));
    expect(caseHits).toHaveLength(0);
  });
});

describe('isa.zyins.cases.share(id, recallToken)', () => {
  it('assembles a fragment-keyed share view for the default zero-knowledge adapter', async () => {
    const server = fakeCaseServer();
    const isa = await buildIsa(server.transport);
    const { id, recallToken } = await isa.zyins.cases.save({
      product: 'zyins',
      payload: { input: { state: 'NC' } },
    });
    expect(typeof recallToken).toBe('string');

    const view = isa.zyins.cases.share(id, recallToken);
    expect(view.id).toBe(id);
    expect(view.recallToken).toBe(recallToken);
    // The recall token MUST land in the URL fragment, never the path or
    // query — the server is zero-knowledge.
    expect(view.link).toMatch(/#k=/);
    expect(view.link).toContain(encodeURIComponent(id));
    expect(view.link!).not.toContain(`?${recallToken}`);
  });

  it('returns link=undefined when the adapter has no recallToken (no fragment material to assemble)', async () => {
    const server = fakeCaseServer();
    const stubStorage: CaseStorage = {
      async put(record) {
        return { id: 'carrier-id-1' };
      },
      async get(_id) {
        return null;
      },
    };
    const isa = await buildIsa(server.transport, { caseStorage: stubStorage });
    const { id, recallToken } = await isa.zyins.cases.save({
      product: 'zyins',
      payload: { input: { state: 'TX' } },
    });
    expect(recallToken).toBeUndefined();

    const view = isa.zyins.cases.share(id);
    expect(view.id).toBe('carrier-id-1');
    expect(view.recallToken).toBeUndefined();
    // Carrier adapters without client-side key material have no URL
    // contract; the SDK degrades to undefined rather than minting a
    // misleading link.
    expect(view.link).toBeUndefined();
  });
});
