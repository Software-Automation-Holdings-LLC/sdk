import { describe, expect, it } from 'vitest';
import { account, recordingTransport } from './helpers';

describe('isa.account.email.enqueue', () => {
  it('POSTs /v1/email/enqueue with a single recipient and base64 attachment', async () => {
    const { transport, requests } = recordingTransport(200, JSON.stringify({ status: 'queued' }));
    const result = await account(transport).email.enqueue({
      to: 'agent@example.com',
      subject: 'Quote',
      body: '<p>Hello</p>',
      attachment: { filename: 'quote.pdf', content: 'JVBERi0xLjQK' },
    });
    expect(result).toEqual({ status: 'queued' });
    expect(requests[0]!.method).toBe('POST');
    expect(requests[0]!.url).toBe('https://test.example/v1/email/enqueue');
    expect(requests[0]!.headers['Idempotency-Key']).toBeTruthy();
    const sent: unknown = JSON.parse(requests[0]!.body);
    expect(sent).toEqual({
      to: 'agent@example.com',
      subject: 'Quote',
      body_html: '<p>Hello</p>',
      attachment: { filename: 'quote.pdf', content_base64: 'JVBERi0xLjQK' },
    });
  });

  it('forwards an array of recipients verbatim', async () => {
    const { transport, requests } = recordingTransport(200, JSON.stringify({ status: '1' }));
    const result = await account(transport).email.enqueue({
      to: ['a@example.com', 'b@example.com'],
      subject: 'Hi',
      body: 'plain text',
    });
    expect(result.status).toBe('queued');
    const parsed: unknown = JSON.parse(requests[0]!.body);
    expect(parsed).toMatchObject({ to: ['a@example.com', 'b@example.com'] });
  });

  it('normalizes "1" status to "queued"', async () => {
    const { transport } = recordingTransport(200, JSON.stringify({ status: '1' }));
    const result = await account(transport).email.enqueue({
      to: 'a@example.com',
      subject: 'Hi',
      body: 'x',
    });
    expect(result.status).toBe('queued');
  });

  it('rejects when no recipient is supplied', async () => {
    const { transport } = recordingTransport(200, '{}');
    await expect(
      account(transport).email.enqueue({ to: '', subject: 'x', body: 'y' }),
    ).rejects.toThrow(/recipient/);
    await expect(
      account(transport).email.enqueue({ to: [], subject: 'x', body: 'y' }),
    ).rejects.toThrow(/recipient/);
  });

  it('maps 400 to a typed error', async () => {
    const { transport } = recordingTransport(
      400,
      JSON.stringify({ type: 'about:blank', status: 400, code: 'validation_error' }),
    );
    await expect(
      account(transport).email.enqueue({ to: 'a@b', subject: 's', body: 'b' }),
    ).rejects.toBeInstanceOf(Error);
  });

  it('maps 500 to a typed error', async () => {
    const { transport } = recordingTransport(
      500,
      JSON.stringify({ type: 'about:blank', status: 500, code: 'server_error' }),
    );
    await expect(
      account(transport).email.enqueue({ to: 'a@b', subject: 's', body: 'b' }),
    ).rejects.toBeInstanceOf(Error);
  });
});
