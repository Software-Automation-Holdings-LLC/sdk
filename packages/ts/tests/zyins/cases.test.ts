import { describe, expect, it } from 'vitest';
import { client, recordingTransport } from './client-test-helpers';

describe('ZyInsClient.cases.create', () => {
  it('POSTs /v1/case with input + results + products and parses the hash response', async () => {
    const responseBody = JSON.stringify({
      object: 'case',
      hash: 'abc123',
      url: 'https://share.example/case/abc123',
      readonly: true,
      created_at: '2026-05-20T14:32:01Z',
    });
    const { transport, requests } = recordingTransport(200, responseBody);
    const result = await client(transport).cases.create({
      input: { applicant: { name: 'John Doe' } },
      results: { decided: true },
      products: ['senior-life'],
    });
    expect(result.hash).toBe('abc123');
    expect(result.url).toBe('https://share.example/case/abc123');
    expect(result.readonly).toBe(true);
    expect(result.createdAt).toBe('2026-05-20T14:32:01Z');
    expect(requests[0]!.method).toBe('POST');
    expect(requests[0]!.url).toBe('https://test.example/v1/case');
    expect(requests[0]!.headers['Idempotency-Key']).toBeTruthy();
    const sent: unknown = JSON.parse(requests[0]!.body);
    expect(sent).toEqual({
      input: { applicant: { name: 'John Doe' } },
      results: { decided: true },
      products: ['senior-life'],
    });
  });

  it('accepts raw-XML input strings', async () => {
    const { transport, requests } = recordingTransport(
      200,
      JSON.stringify({ object: 'case', hash: 'xml1', url: '', readonly: false, created_at: '' }),
    );
    await client(transport).cases.create({ input: '<applicant/>' });
    const sent = JSON.parse(requests[0]!.body) as { input: unknown };
    expect(sent.input).toBe('<applicant/>');
  });

  it('uses the same Idempotency-Key on retry of the same body', async () => {
    const { transport, requests } = recordingTransport(
      200,
      JSON.stringify({ object: 'case', hash: 'h', url: '', readonly: false, created_at: '' }),
    );
    const c = client(transport);
    await c.cases.create({ input: { a: 1 } });
    await c.cases.create({ input: { a: 1 } });
    expect(requests[0]!.headers['Idempotency-Key']).toBe(requests[1]!.headers['Idempotency-Key']);
  });

  it('rejects missing input', async () => {
    const { transport } = recordingTransport(200, '{}');
    await expect(
      client(transport).cases.create({} as unknown as { input: Record<string, unknown> }),
    ).rejects.toThrow(/input/);
  });

  it('maps 500 to a typed error', async () => {
    const { transport } = recordingTransport(
      500,
      JSON.stringify({ type: 'about:blank', title: 'server', status: 500, code: 'server_error' }),
    );
    await expect(client(transport).cases.create({ input: { a: 1 } })).rejects.toBeInstanceOf(Error);
  });

  it('throws a clear error when the success body is invalid JSON', async () => {
    const { transport } = recordingTransport(200, '{');
    await expect(client(transport).cases.create({ input: { a: 1 } })).rejects.toThrow(/not valid JSON/);
  });

  it('rejects a non-object success body', async () => {
    const { transport } = recordingTransport(200, 'null');
    await expect(client(transport).cases.create({ input: { a: 1 } })).rejects.toThrow(/not an object/);
  });
});

describe('ZyInsClient.cases.email', () => {
  it('delegates to /v1/email/enqueue with the case-share payload', async () => {
    const { transport, requests } = recordingTransport(
      200,
      JSON.stringify({ enqueue_id: 'eq_1' }),
    );
    const result = await client(transport).cases.email({
      to: 'jane@smith.com',
      subject: 'Your case',
      bodyHtml: '<p>Hi</p>',
      attachmentFilename: 'case-1.pdf',
      attachmentContent: 'PDF-bytes',
    });
    expect(result.enqueueId).toBe('eq_1');
    expect(requests[0]!.url).toBe('https://test.example/v1/email/enqueue');
  });
});
