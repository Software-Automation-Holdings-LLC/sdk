import { describe, expect, it } from 'vitest';
import { client, recordingTransport } from './client-test-helpers';

const CASE_ID = '9f1c2d3e-4b5a-6c7d-8e9f-0a1b2c3d4e5f';

/** Read a recorded request body as a string-keyed record (test trust edge). */
function bodyRecord(body: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(body);
  return parsed as Record<string, unknown>;
}

describe('ZyInsClient.cases.share', () => {
  it('encrypts {input,results,products}, POSTs only the opaque envelope, returns {id,link}', async () => {
    const { transport, requests } = recordingTransport(
      201,
      JSON.stringify({ object: 'case', id: CASE_ID }),
    );
    const result = await client(transport).cases.share({
      input: { applicant: { name: 'John Doe' } },
      results: { decided: true },
      products: ['senior-life'],
    });
    expect(result.id).toBe(CASE_ID);
    expect(result.link).toContain(`/c/${CASE_ID}#k=`);
    expect(requests[0]!.method).toBe('POST');
    expect(requests[0]!.url).toBe('https://test.example/v1/case');
    expect(requests[0]!.headers['Idempotency-Key']).toBeTruthy();
    const sent = bodyRecord(requests[0]!.body);
    expect(Object.keys(sent).sort()).toEqual(['ciphertext', 'iv', 'product', 'tag']);
    expect(sent['product']).toBe('zyins');
    // Neither the plaintext input nor the fragment key is on the wire.
    const fragment = result.link.slice(result.link.indexOf('#k=') + 3);
    expect(requests[0]!.body).not.toContain('John Doe');
    expect(requests[0]!.body).not.toContain(fragment);
  });

  it('create() is a back-compat alias for share()', async () => {
    const { transport } = recordingTransport(201, JSON.stringify({ object: 'case', id: CASE_ID }));
    const result = await client(transport).cases.create({ input: '<applicant/>' });
    expect(result.id).toBe(CASE_ID);
    expect(result.link).toContain(`/c/${CASE_ID}#k=`);
  });

  it('rejects missing input', async () => {
    const { transport } = recordingTransport(201, '{}');
    await expect(
      client(transport).cases.share({} as unknown as { input: Record<string, unknown> }),
    ).rejects.toThrow(/input/);
  });

  it('maps 500 to a typed error', async () => {
    const { transport } = recordingTransport(
      500,
      JSON.stringify({ type: 'about:blank', title: 'server', status: 500, code: 'server_error' }),
    );
    await expect(client(transport).cases.share({ input: { a: 1 } })).rejects.toBeInstanceOf(Error);
  });

  it('throws a clear error when the success body is invalid JSON', async () => {
    const { transport } = recordingTransport(201, '{');
    await expect(client(transport).cases.share({ input: { a: 1 } })).rejects.toThrow(
      /not valid JSON/,
    );
  });
});

describe('ZyInsClient.cases.email', () => {
  it('delegates to /v1/email/enqueue with the case-share payload', async () => {
    const { transport, requests } = recordingTransport(200, JSON.stringify({ enqueue_id: 'eq_1' }));
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
