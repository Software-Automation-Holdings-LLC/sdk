import { describe, expect, it } from 'vitest';
import { account, recordingTransport } from './helpers';

describe('isa.account.cases.create', () => {
  it('POSTs /v1/case with input + results + products and parses the response', async () => {
    const body = JSON.stringify({
      object: 'case',
      hash: 'abc123',
      url: 'https://example.com/case/abc123',
      readonly: false,
      created_at: '2026-05-20T12:00:00Z',
    });
    const { transport, requests } = recordingTransport(200, body);
    const result = await account(transport).cases.create({
      input: { applicant: { dob: '1962-04-18' } },
      results: { decision: 'approved' },
      products: ['colonial-penn'],
    });
    expect(result.hash).toBe('abc123');
    expect(result.url).toBe('https://example.com/case/abc123');
    expect(result.readonly).toBe(false);
    expect(result.createdAt).toBe('2026-05-20T12:00:00Z');
    expect(requests[0]!.method).toBe('POST');
    expect(requests[0]!.url).toBe('https://test.example/v1/case');
    expect(requests[0]!.headers['Idempotency-Key']).toBeTruthy();
    const sent: unknown = JSON.parse(requests[0]!.body);
    expect(sent).toEqual({
      input: { applicant: { dob: '1962-04-18' } },
      results: { decision: 'approved' },
      products: ['colonial-penn'],
    });
  });

  it('rejects missing input', async () => {
    const { transport } = recordingTransport(200, '{}');
    await expect(
      // @ts-expect-error — runtime guard
      account(transport).cases.create({}),
    ).rejects.toThrow(/input/);
  });

  it('rejects blank string input', async () => {
    const { transport } = recordingTransport(200, '{}');
    await expect(account(transport).cases.create({ input: '   ' })).rejects.toThrow(/input/);
  });

  it('maps 400 to a typed error', async () => {
    const { transport } = recordingTransport(
      400,
      JSON.stringify({ type: 'about:blank', status: 400, code: 'validation_error' }),
    );
    await expect(
      account(transport).cases.create({ input: { x: 1 } }),
    ).rejects.toBeInstanceOf(Error);
  });

  it('wraps invalid create response JSON with context', async () => {
    const { transport } = recordingTransport(200, '<html>bad gateway</html>');
    await expect(account(transport).cases.create({ input: { x: 1 } })).rejects.toThrow(
      /cases\.create response was not valid JSON/,
    );
  });

  it('rejects non-object create responses', async () => {
    const { transport } = recordingTransport(200, JSON.stringify({ data: 1 }));
    await expect(account(transport).cases.create({ input: { x: 1 } })).rejects.toThrow(
      /cases\.create response body was not a JSON object/,
    );
  });
});

describe('isa.account.cases.get', () => {
  it('GETs /v1/case/{id} and parses the response', async () => {
    const body = JSON.stringify({
      hash: 'abc123',
      url: 'https://example.com/case/abc123',
      readonly: true,
      created_at: '2026-05-20T12:00:00Z',
      input: { x: 1 },
      results: { y: 2 },
      products: ['p1'],
    });
    const { transport, requests } = recordingTransport(200, body);
    const result = await account(transport).cases.get('abc123');
    expect(result.hash).toBe('abc123');
    expect(result.readonly).toBe(true);
    expect(result.input).toEqual({ x: 1 });
    expect(result.results).toEqual({ y: 2 });
    expect(result.products).toEqual(['p1']);
    expect(requests[0]!.method).toBe('GET');
    expect(requests[0]!.url).toBe('https://test.example/v1/case/abc123');
  });

  it('rejects an empty case id', async () => {
    const { transport } = recordingTransport(200, '{}');
    await expect(account(transport).cases.get('')).rejects.toThrow(/case id/);
  });

  it('maps 404 to a typed error', async () => {
    const { transport } = recordingTransport(
      404,
      JSON.stringify({ type: 'about:blank', status: 404, code: 'not_found' }),
    );
    await expect(account(transport).cases.get('missing')).rejects.toBeInstanceOf(Error);
  });

  it('wraps invalid get response JSON with context', async () => {
    const { transport } = recordingTransport(200, '<html>bad gateway</html>');
    await expect(account(transport).cases.get('abc123')).rejects.toThrow(
      /cases\.get response was not valid JSON/,
    );
  });

  it('rejects non-object get responses', async () => {
    const { transport } = recordingTransport(200, JSON.stringify({ data: 1 }));
    await expect(account(transport).cases.get('abc123')).rejects.toThrow(
      /cases\.get response body was not a JSON object/,
    );
  });
});

describe('isa.account.cases.list', () => {
  it('GETs /v1/case and parses a bare array', async () => {
    const body = JSON.stringify([
      { hash: 'a', url: 'u1', readonly: false, created_at: 't1' },
      { hash: 'b', url: 'u2', readonly: true, created_at: 't2' },
    ]);
    const { transport, requests } = recordingTransport(200, body);
    const result = await account(transport).cases.list();
    expect(result).toHaveLength(2);
    expect(result[0]!.hash).toBe('a');
    expect(result[1]!.readonly).toBe(true);
    expect(requests[0]!.method).toBe('GET');
    expect(requests[0]!.url).toBe('https://test.example/v1/case');
  });

  it('accepts the { cases: [...] } shape', async () => {
    const body = JSON.stringify({
      cases: [{ hash: 'x', url: 'u', readonly: false, created_at: 't' }],
    });
    const { transport } = recordingTransport(200, body);
    const result = await account(transport).cases.list();
    expect(result).toHaveLength(1);
    expect(result[0]!.hash).toBe('x');
  });

  it('accepts the enveloped { data: [...] } shape', async () => {
    const body = JSON.stringify({
      data: [{ hash: 'y', url: 'u', readonly: false, created_at: 't' }],
    });
    const { transport } = recordingTransport(200, body);
    const result = await account(transport).cases.list();
    expect(result).toHaveLength(1);
  });

  it('maps 500 to a typed error', async () => {
    const { transport } = recordingTransport(
      500,
      JSON.stringify({ type: 'about:blank', status: 500, code: 'server_error' }),
    );
    await expect(account(transport).cases.list()).rejects.toBeInstanceOf(Error);
  });

  it('wraps invalid list response JSON with context', async () => {
    const { transport } = recordingTransport(200, '<html>bad gateway</html>');
    await expect(account(transport).cases.list()).rejects.toThrow(
      /cases\.list response was not valid JSON/,
    );
  });
});

describe('isa.account.cases.email', () => {
  it('POSTs /v1/case/{id}/email with the recipient', async () => {
    const { transport, requests } = recordingTransport(202, '');
    const result = await account(transport).cases.email({
      caseId: 'abc123',
      to: 'agent@example.com',
    });
    expect(result).toEqual({ queued: true });
    expect(requests[0]!.method).toBe('POST');
    expect(requests[0]!.url).toBe('https://test.example/v1/case/abc123/email');
    expect(requests[0]!.headers['Idempotency-Key']).toBeTruthy();
    const sent: unknown = JSON.parse(requests[0]!.body);
    expect(sent).toEqual({ to: 'agent@example.com' });
  });

  it('rejects missing caseId or to', async () => {
    const { transport } = recordingTransport(200, '{}');
    await expect(
      account(transport).cases.email({ caseId: '', to: 'a@b' }),
    ).rejects.toThrow(/caseId/);
    await expect(
      account(transport).cases.email({ caseId: 'x', to: '' }),
    ).rejects.toThrow(/to address/);
  });

  it('maps 404 to a typed error', async () => {
    const { transport } = recordingTransport(
      404,
      JSON.stringify({ type: 'about:blank', status: 404, code: 'not_found' }),
    );
    await expect(
      account(transport).cases.email({ caseId: 'missing', to: 'a@b' }),
    ).rejects.toBeInstanceOf(Error);
  });
});
