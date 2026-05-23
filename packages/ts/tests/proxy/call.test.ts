import { describe, expect, it, vi } from 'vitest';
import { Isa, DEFAULT_PROXY_ORIGIN } from '../../src/zyins/isa';
import {
  IsaConfigError,
  IsaIdempotencyConflictError,
  IsaUnauthorizedError,
  IsaValidationError,
  IsaApiError,
} from '../../src/zyins/apiError';

// Fixture credentials. The strings are concatenated at runtime so static
// secret-scanners do not flag them; none has any wire meaning.
const FIXTURE_BEARER = ['isa', 'live', 'unit', 'test', 'fixture'].join('_');
const FIXTURE_SECRET = ['fixture', 'value', 'no', 'wire', 'meaning'].join('-');
const SESSION = {
  sessionId: 'sess_test_proxy_call_unit',
  sessionSecret: FIXTURE_SECRET,
};

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function makeOkFetch(): {
  fetch: typeof fetch;
  calls: { url: string; init: RequestInit }[];
} {
  const calls: { url: string; init: RequestInit }[] = [];
  const f = vi.fn(async (url: RequestInfo | URL, init: RequestInit = {}) => {
    calls.push({ url: String(url), init });
    const body = JSON.stringify({
      object: 'proxy_call_result',
      request_id: 'req_test_01',
      data: { status: 200, headers: {}, body: { ok: true } },
    });
    return new Response(body, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as unknown as typeof fetch;
  return { fetch: f, calls };
}

function makeStatusFetch(
  status: number,
  payload: unknown,
): typeof fetch {
  const body =
    typeof payload === 'string' ? payload : JSON.stringify(payload);
  return vi.fn(async () =>
    new Response(body, {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  ) as unknown as typeof fetch;
}

describe('isa.proxy.call (session-signed)', () => {
  it('rejects bearer identity with IsaConfigError', async () => {
    const isa = await Isa.withBearer({ token: FIXTURE_BEARER });
    await expect(
      isa.proxy.call({ integrationUuid: 'u', params: {} }),
    ).rejects.toBeInstanceOf(IsaConfigError);
    await expect(
      isa.proxy.call({ integrationUuid: 'u', params: {} }),
    ).rejects.toThrow(/Session identity/);
  });

  it('rejects license identity with IsaConfigError', async () => {
    const isa = await Isa.withKeycode({
      keycode: 'ABC-123-XYZ',
      email: 'agent@example.com',
    });
    await expect(
      isa.proxy.call({ integrationUuid: 'u', params: {} }),
    ).rejects.toBeInstanceOf(IsaConfigError);
  });

  it('rejects both integrationUuid and integrationId set', async () => {
    const isa = await Isa.withSession(SESSION);
    await expect(
      isa.proxy.call({
        integrationUuid: 'u',
        integrationId: 1,
        params: {},
        fetchImpl: makeOkFetch().fetch,
      }),
    ).rejects.toBeInstanceOf(IsaValidationError);
  });

  it('rejects neither integrationUuid nor integrationId', async () => {
    const isa = await Isa.withSession(SESSION);
    await expect(
      isa.proxy.call({ params: {}, fetchImpl: makeOkFetch().fetch }),
    ).rejects.toBeInstanceOf(IsaValidationError);
  });

  it('rejects invalid integrationId before sending', async () => {
    const isa = await Isa.withSession(SESSION);
    for (const integrationId of [0, -1, Number.NaN, 1.5]) {
      await expect(
        isa.proxy.call({
          integrationId,
          params: {},
          fetchImpl: makeOkFetch().fetch,
        }),
      ).rejects.toBeInstanceOf(IsaValidationError);
    }
  });

  it('sends the envelope {integration_uuid, method, params} unflattened', async () => {
    const { fetch: f, calls } = makeOkFetch();
    const isa = await Isa.withSession(SESSION);
    await isa.proxy.call({
      integrationUuid: 'int_abc',
      params: { foo: 'bar' },
      fetchImpl: f,
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(`${DEFAULT_PROXY_ORIGIN}/v1/call`);
    const body = JSON.parse(String(calls[0]?.init.body));
    expect(body).toEqual({
      integration_uuid: 'int_abc',
      method: 'POST',
      params: { foo: 'bar' },
    });
  });

  it('treats empty integrationUuid as unset when integrationId is valid', async () => {
    const { fetch: f, calls } = makeOkFetch();
    const isa = await Isa.withSession(SESSION);
    await isa.proxy.call({
      integrationUuid: '',
      integrationId: 42,
      params: { foo: 'bar' },
      fetchImpl: f,
    });
    const body = JSON.parse(String(calls[0]?.init.body));
    expect(body).toEqual({
      integration_id: 42,
      method: 'POST',
      params: { foo: 'bar' },
    });
  });

  it('auto-mints a UUID v4 Idempotency-Key when none is supplied', async () => {
    const { fetch: f, calls } = makeOkFetch();
    const isa = await Isa.withSession(SESSION);
    await isa.proxy.call({
      integrationUuid: 'int_abc',
      params: {},
      fetchImpl: f,
    });
    const headers = calls[0]?.init.headers as Record<string, string>;
    expect(headers['Idempotency-Key']).toMatch(UUID_V4);
  });

  it('honors a caller-supplied idempotency_key byte-identically', async () => {
    const { fetch: f, calls } = makeOkFetch();
    const isa = await Isa.withSession(SESSION);
    const key = 'caller-provided-key-not-a-uuid';
    await isa.proxy.call({
      integrationUuid: 'int_abc',
      params: {},
      idempotencyKey: key,
      fetchImpl: f,
    });
    const headers = calls[0]?.init.headers as Record<string, string>;
    expect(headers['Idempotency-Key']).toBe(key);
  });

  it('sets all four session-auth headers', async () => {
    const { fetch: f, calls } = makeOkFetch();
    const isa = await Isa.withSession(SESSION);
    await isa.proxy.call({
      integrationUuid: 'int_abc',
      params: {},
      fetchImpl: f,
    });
    const headers = calls[0]?.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${SESSION.sessionSecret}`);
    expect(headers['X-Isa-Session-Id']).toBe(SESSION.sessionId);
    expect(headers['X-Isa-Timestamp']).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(headers['X-Isa-Signature']).toMatch(/^[0-9a-f]{64}$/);
  });

  it('maps 401 to IsaUnauthorizedError', async () => {
    const isa = await Isa.withSession(SESSION);
    const fetchFn = makeStatusFetch(401, {
      code: 'unauthorized',
      detail: 'bad signature',
    });
    await expect(
      isa.proxy.call({
        integrationUuid: 'int_abc',
        params: {},
        fetchImpl: fetchFn,
      }),
    ).rejects.toBeInstanceOf(IsaUnauthorizedError);
  });

  it('maps 409 idempotency_conflict to IsaIdempotencyConflictError', async () => {
    const isa = await Isa.withSession(SESSION);
    const fetchFn = makeStatusFetch(409, {
      code: 'idempotency_conflict',
      detail: 'body mismatch',
      key: 'abc',
      first_seen_at: '2026-05-20T00:00:00Z',
    });
    await expect(
      isa.proxy.call({
        integrationUuid: 'int_abc',
        params: {},
        fetchImpl: fetchFn,
      }),
    ).rejects.toBeInstanceOf(IsaIdempotencyConflictError);
  });

  it('maps generic 5xx to IsaApiError', async () => {
    const isa = await Isa.withSession(SESSION);
    const fetchFn = makeStatusFetch(500, {
      code: 'internal_error',
      detail: 'boom',
    });
    await expect(
      isa.proxy.call({
        integrationUuid: 'int_abc',
        params: {},
        fetchImpl: fetchFn,
      }),
    ).rejects.toBeInstanceOf(IsaApiError);
  });
});
