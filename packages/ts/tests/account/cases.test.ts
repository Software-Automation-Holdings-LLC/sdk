import { describe, expect, it } from 'vitest';
import {
  account,
  accountWithViewer,
  recordingTransport,
  scriptedTransport,
  TEST_CASE_VIEWER_BASE_URL,
} from './helpers';
import { IsaCaseExpiredError } from '../../src/zyins/apiError';

const CASE_ID = '9f1c2d3e-4b5a-6c7d-8e9f-0a1b2c3d4e5f';
const CREATED_AT = '2026-05-14T14:32:01Z';
const EXPIRES_AT = '2026-05-21T14:32:01Z';

type TWireEnvelope = { product: string; ciphertext: string; iv: string; tag: string };

/** Parse a recorded request body into a string-keyed record. */
function parseBody(body: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(body);
  return parsed as Record<string, unknown>;
}

/** Read the posted opaque envelope off a recorded POST body. */
function envelopeFrom(body: string): TWireEnvelope {
  const r = parseBody(body);
  return {
    product: String(r['product']),
    ciphertext: String(r['ciphertext']),
    iv: String(r['iv']),
    tag: String(r['tag']),
  };
}

/**
 * A stateful opaque-case server: stores the POSTed `{product,ciphertext,iv,
 * tag}` and serves it back verbatim on GET, so create→open exercises real
 * AES-GCM round-tripping through the wire shape.
 */
function opaqueCaseServer(): ReturnType<typeof scriptedTransport> {
  let stored: TWireEnvelope | undefined;
  return scriptedTransport((req) => {
    if (req.method === 'POST' && req.url.endsWith('/v1/case')) {
      stored = envelopeFrom(req.body);
      return { status: 201, body: JSON.stringify({ object: 'case', id: CASE_ID }) };
    }
    if (req.method === 'GET' && req.url.includes('/v1/case/')) {
      if (!stored) return { status: 404, body: '' };
      return {
        status: 200,
        body: JSON.stringify({ object: 'case', expires_at: EXPIRES_AT, ...stored }),
      };
    }
    return { status: 500, body: '' };
  });
}

describe('isa.account.cases.create', () => {
  it('encrypts, POSTs exactly {product,ciphertext,iv,tag}, and assembles the fragment link', async () => {
    const { transport, requests } = opaqueCaseServer();
    const result = await accountWithViewer(transport, TEST_CASE_VIEWER_BASE_URL).cases.create({
      product: 'zyins',
      payload: { applicant: { dob: '1962-04-18' } },
    });
    expect(result.id).toBe(CASE_ID);
    expect(result.link).toBe(`${TEST_CASE_VIEWER_BASE_URL}/c/${CASE_ID}#k=${linkKey(result.link)}`);
    expect(requests[0]!.method).toBe('POST');
    expect(requests[0]!.url).toBe('https://test.example/v1/case');
    expect(requests[0]!.headers['Idempotency-Key']).toBeTruthy();
    const sent = parseBody(requests[0]!.body);
    expect(Object.keys(sent).sort()).toEqual(['ciphertext', 'iv', 'product', 'tag']);
    expect(sent['product']).toBe('zyins');
  });

  it('rejects a missing product', async () => {
    const { transport } = recordingTransport(201, '{}');
    await expect(
      // @ts-expect-error — runtime guard
      account(transport).cases.create({ payload: { x: 1 } }),
    ).rejects.toThrow(/product/);
  });

  it('rejects a missing payload', async () => {
    const { transport } = recordingTransport(201, '{}');
    await expect(
      // @ts-expect-error — runtime guard
      account(transport).cases.create({ product: 'zyins' }),
    ).rejects.toThrow(/payload/);
  });

  it('maps a non-2xx create to a typed error', async () => {
    const { transport } = recordingTransport(
      400,
      JSON.stringify({ type: 'about:blank', status: 400, code: 'validation_error' }),
    );
    await expect(
      account(transport).cases.create({ product: 'zyins', payload: { x: 1 } }),
    ).rejects.toBeInstanceOf(Error);
  });

  it('rejects a malformed create response before assembling a link', async () => {
    const { transport } = recordingTransport(201, JSON.stringify({ object: 'case' }));
    await expect(
      account(transport).cases.create({ product: 'zyins', payload: { x: 1 } }),
    ).rejects.toThrow(/missing "id"/);
  });
});

describe('isa.account.cases roundtrip', () => {
  it('create → open recovers the exact payload and product', async () => {
    const { transport } = opaqueCaseServer();
    const ns = accountWithViewer(transport, TEST_CASE_VIEWER_BASE_URL);
    const payload = { applicant: { dob: '1962-04-18', state: 'NC' }, n: 42 };
    const { link } = await ns.cases.create({ product: 'zyins', payload });
    const opened = await ns.cases.open(link);
    expect(opened.product).toBe('zyins');
    expect(opened.payload).toEqual(payload);
  });

  it('GET path carries the case id and Accept JSON', async () => {
    const { transport, requests } = opaqueCaseServer();
    const ns = accountWithViewer(transport, TEST_CASE_VIEWER_BASE_URL);
    const { link } = await ns.cases.create({ product: 'eapp', payload: { ok: true } });
    await ns.cases.open(link);
    const getReq = requests.find((r) => r.method === 'GET')!;
    expect(getReq.url).toBe(`https://test.example/v1/case/${CASE_ID}`);
    expect(getReq.headers['Accept']).toBe('application/json');
  });
});

describe('isa.account.cases.open decrypt failures', () => {
  it('fails to decrypt when the product (AEAD) does not match', async () => {
    // Encrypt under `zyins`, then serve the envelope back tagged `eapp` so the
    // AEAD binding no longer verifies.
    let cached: TWireEnvelope | undefined;
    const { transport } = scriptedTransport((req) => {
      if (req.method === 'POST') {
        cached = { ...envelopeFrom(req.body), product: 'eapp' };
        return { status: 201, body: JSON.stringify({ object: 'case', id: CASE_ID }) };
      }
      return {
        status: 200,
        body: JSON.stringify({ object: 'case', expires_at: EXPIRES_AT, ...cached }),
      };
    });
    const ns = accountWithViewer(transport, TEST_CASE_VIEWER_BASE_URL);
    const { link } = await ns.cases.create({ product: 'zyins', payload: { secret: 1 } });
    await expect(ns.cases.open(link)).rejects.toThrow(/failed authentication/);
  });

  it('fails to decrypt with a wrong fragment key', async () => {
    const { transport } = opaqueCaseServer();
    const ns = accountWithViewer(transport, TEST_CASE_VIEWER_BASE_URL);
    const { link } = await ns.cases.create({ product: 'zyins', payload: { x: 1 } });
    const tampered = link.replace(/#k=.*$/, '#k=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
    await expect(ns.cases.open(tampered)).rejects.toThrow(/failed authentication/);
  });

  it('maps a 404 (absent or expired) to IsaCaseExpiredError', async () => {
    const link = `${TEST_CASE_VIEWER_BASE_URL}/c/${CASE_ID}#k=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`;
    const { transport } = recordingTransport(404, '');
    await expect(account(transport).cases.open(link)).rejects.toBeInstanceOf(IsaCaseExpiredError);
  });

  it('rejects a link missing its #k= fragment', async () => {
    const { transport } = recordingTransport(200, '{}');
    await expect(
      account(transport).cases.open(`${TEST_CASE_VIEWER_BASE_URL}/c/${CASE_ID}`),
    ).rejects.toThrow(/fragment key/);
  });

  it('rejects malformed share-link routes before fetching', async () => {
    const { transport, requests } = recordingTransport(200, '{}');
    await expect(
      account(transport).cases.open(`${TEST_CASE_VIEWER_BASE_URL}#k=abc`),
    ).rejects.toThrow(/must match/);
    await expect(
      account(transport).cases.open(`${TEST_CASE_VIEWER_BASE_URL}/c/#k=abc`),
    ).rejects.toThrow(/must match/);
    expect(requests).toHaveLength(0);
  });
});

describe('isa.account.cases.list', () => {
  it('POSTs /v1/case/list and parses metadata without ciphertext', async () => {
    const body = JSON.stringify({
      object: 'list',
      data: [
        { id: 'a', product: 'zyins', created_at: CREATED_AT, expires_at: EXPIRES_AT },
        { id: 'b', product: 'eapp', created_at: CREATED_AT, expires_at: EXPIRES_AT },
      ],
    });
    const { transport, requests } = recordingTransport(200, body);
    const result = await account(transport).cases.list();
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: 'a',
      product: 'zyins',
      createdAt: CREATED_AT,
      expiresAt: EXPIRES_AT,
    });
    expect(result[0]).not.toHaveProperty('ciphertext');
    expect(requests[0]!.method).toBe('POST');
    expect(requests[0]!.url).toBe('https://test.example/v1/case/list');
  });

  it('maps 500 to a typed error', async () => {
    const { transport } = recordingTransport(
      500,
      JSON.stringify({ type: 'about:blank', status: 500, code: 'server_error' }),
    );
    await expect(account(transport).cases.list()).rejects.toBeInstanceOf(Error);
  });

  it('rejects malformed success responses instead of returning an empty list', async () => {
    const missingData = recordingTransport(200, JSON.stringify({ object: 'list' }));
    await expect(account(missingData.transport).cases.list()).rejects.toThrow(/data array/);

    const badRow = recordingTransport(
      200,
      JSON.stringify({ object: 'list', data: [{ product: 'zyins' }] }),
    );
    await expect(account(badRow.transport).cases.list()).rejects.toThrow(/missing "id"/);
  });
});

describe('isa.account.cases.email', () => {
  it('POSTs /v1/case/{id}/email with the recipient', async () => {
    const { transport, requests } = recordingTransport(202, '');
    const result = await account(transport).cases.email({
      caseId: CASE_ID,
      to: 'jane.smith@example.com',
    });
    expect(result).toEqual({ queued: true });
    expect(requests[0]!.method).toBe('POST');
    expect(requests[0]!.url).toBe(`https://test.example/v1/case/${CASE_ID}/email`);
    expect(requests[0]!.headers['Idempotency-Key']).toBeTruthy();
    const sent = parseBody(requests[0]!.body);
    expect(sent).toEqual({ to: 'jane.smith@example.com' });
  });

  it('rejects missing caseId or to', async () => {
    const { transport } = recordingTransport(200, '{}');
    await expect(account(transport).cases.email({ caseId: '', to: 'a@b' })).rejects.toThrow(
      /caseId/,
    );
    await expect(account(transport).cases.email({ caseId: 'x', to: '' })).rejects.toThrow(
      /to address/,
    );
  });
});

/** Extract the `#k=` fragment value from an assembled share link. */
function linkKey(link: string): string {
  return link.slice(link.indexOf('#k=') + '#k='.length);
}
