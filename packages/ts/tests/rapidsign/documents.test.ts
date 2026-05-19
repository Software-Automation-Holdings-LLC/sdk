import { describe, expect, it } from 'vitest';
import { RapidSignClient } from '../../src/rapidsign/client';
import { RapidSignError } from '../../src/rapidsign/errors';
import {
  CREATE_OK_BODY,
  FIXED_CLOCK,
  NOTIFY_OK_BODY,
  SEND_REQUEST,
  TEST_BASE,
  TEST_TOKEN,
  counterUUID,
  gzipBase64,
  instantSleeper,
  queueTransport,
} from './fixtures';

function newClient(transport: ReturnType<typeof queueTransport>['transport']): RapidSignClient {
  const { sleeper } = instantSleeper();
  return new RapidSignClient(TEST_TOKEN, {
    baseUrl: TEST_BASE,
    transport,
    clock: FIXED_CLOCK,
    sleeper,
    uuid: counterUUID(),
    maxRetries: 0,
  });
}

describe('documents.send', () => {
  it('issues a CreateDocument + NotifyDocument pair and returns a typed Envelope', async () => {
    const { transport, calls } = queueTransport([
      { status: 200, body: CREATE_OK_BODY, headers: { 'x-request-id': 'req_create' } },
      { status: 202, body: NOTIFY_OK_BODY, headers: { 'x-request-id': 'req_notify' } },
    ]);
    const client = newClient(transport);
    const env = await client.documents.send(SEND_REQUEST);
    expect(calls).toHaveLength(2);
    expect(calls[0]!.request.url).toBe(`${TEST_BASE}/v1/documents`);
    expect(calls[0]!.request.method).toBe('POST');
    expect(calls[1]!.request.url).toBe(`${TEST_BASE}/v1/documents/sig_test_1/notify`);
    expect(env.id).toBe('doc_test_1');
    expect(env.signId).toBe('sig_test_1');
    expect(env.signUrl).toBe('https://sign.example/sig_test_1');
    expect(env.viewUrl).toBe('https://view.example/view_test_1');
    expect(env.status).toBe('notified');
    expect(env.recipient.email).toBe('john.doe@acme-agency.com');
    expect(env.metadata.applicationId).toBe('app_1234');
    expect(env.createdAt).toBeInstanceOf(Date);
    expect(env.expiresAt).toBeInstanceOf(Date);
    expect(env.hashes['https://example.com/a.pdf']).toBe('abc123');
  });

  it('sends an auto-generated Idempotency-Key on the Create call', async () => {
    const { transport, calls } = queueTransport([
      { status: 200, body: CREATE_OK_BODY },
      { status: 202, body: NOTIFY_OK_BODY },
    ]);
    const client = newClient(transport);
    await client.documents.send(SEND_REQUEST);
    const createKey = calls[0]!.request.headers['Idempotency-Key'];
    const notifyKey = calls[1]!.request.headers['Idempotency-Key'];
    expect(createKey).toMatch(/^[0-9a-f-]{36}$/);
    expect(notifyKey).toMatch(/^[0-9a-f-]{36}$/);
    expect(createKey).not.toBe(notifyKey);
  });

  it('honours a caller-supplied idempotencyKey on the Create call', async () => {
    const { transport, calls } = queueTransport([
      { status: 200, body: CREATE_OK_BODY },
      { status: 202, body: NOTIFY_OK_BODY },
    ]);
    const client = newClient(transport);
    const myKey = 'my-explicit-key-aaaaaaaaaaaa';
    await client.documents.send({ ...SEND_REQUEST, idempotencyKey: myKey });
    expect(calls[0]!.request.headers['Idempotency-Key']).toBe(myKey);
  });

  it('rejects an empty packet', async () => {
    const { transport } = queueTransport([]);
    const client = newClient(transport);
    await expect(
      client.documents.send({ ...SEND_REQUEST, packet: [] }),
    ).rejects.toBeInstanceOf(RapidSignError.ValidationError);
  });

  it('rejects a missing recipient email', async () => {
    const { transport } = queueTransport([]);
    const client = newClient(transport);
    await expect(
      // @ts-expect-error — testing runtime validation
      client.documents.send({ ...SEND_REQUEST, recipient: {} }),
    ).rejects.toBeInstanceOf(RapidSignError.ValidationError);
  });

  it('rejects an empty recipient email', async () => {
    const { transport } = queueTransport([]);
    const client = newClient(transport);
    await expect(
      client.documents.send({ ...SEND_REQUEST, recipient: { email: '' } }),
    ).rejects.toBeInstanceOf(RapidSignError.ValidationError);
  });

  it('includes client-minted sign_ids on the CreateDocument body', async () => {
    const { transport, calls } = queueTransport([
      { status: 200, body: CREATE_OK_BODY },
      { status: 202, body: NOTIFY_OK_BODY },
    ]);
    const client = newClient(transport);
    await client.documents.send(SEND_REQUEST);
    const createBody = JSON.parse(calls[0]!.request.body) as { sign_ids?: string[] };
    expect(createBody.sign_ids).toHaveLength(1);
    expect(createBody.sign_ids![0]).toMatch(
      /^00000000-0000-4000-8000-[0-9a-f]{12}$/,
    );
    expect(calls[1]!.request.url).toBe(`${TEST_BASE}/v1/documents/sig_test_1/notify`);
  });

  it('translates a 400 ProblemDetails on Create into a typed ValidationError', async () => {
    const { transport } = queueTransport([
      {
        status: 400,
        body: JSON.stringify({
          type: 't',
          title: 'Validation failed',
          status: 400,
          code: 'validation_error',
          detail: 'packet[0].url must be https',
          param: 'packet[0].url',
        }),
      },
    ]);
    const client = newClient(transport);
    await expect(client.documents.send(SEND_REQUEST)).rejects.toMatchObject({
      code: 'validation_error',
      field: 'packet[0].url',
    });
  });

  it('passes the binding legal text and metadata into the Create body', async () => {
    const { transport, calls } = queueTransport([
      { status: 200, body: CREATE_OK_BODY },
      { status: 202, body: NOTIFY_OK_BODY },
    ]);
    const client = newClient(transport);
    await client.documents.send(SEND_REQUEST);
    const body = JSON.parse(calls[0]!.request.body);
    expect(body.binding_legal_text).toBe('I agree to the terms above.');
    expect(body.metadata.applicationId).toBe('app_1234');
    expect(body.packet[0].url).toBe('https://example.com/a.pdf');
    expect(body.is_production).toBe(true);
    expect(body.remote_allowed).toBe(true);
    expect(typeof body.session_id).toBe('string');
  });

  it('encodes a numeric expiresIn (ms) as ISO-8601 seconds', async () => {
    const { transport, calls } = queueTransport([
      { status: 200, body: CREATE_OK_BODY },
      { status: 202, body: NOTIFY_OK_BODY },
    ]);
    const client = newClient(transport);
    await client.documents.send({ ...SEND_REQUEST, expiresIn: 86_400_000 });
    const body = JSON.parse(calls[0]!.request.body);
    expect(body.ttl).toBe('PT86400S');
  });

  it('uppercases lowercase ISO-8601 expiresIn on the wire', async () => {
    const { transport, calls } = queueTransport([
      { status: 200, body: CREATE_OK_BODY },
      { status: 202, body: NOTIFY_OK_BODY },
    ]);
    const client = newClient(transport);
    await client.documents.send({ ...SEND_REQUEST, expiresIn: 'p14d' });
    const body = JSON.parse(calls[0]!.request.body);
    expect(body.ttl).toBe('P14D');
  });

  it('passes through an ISO-8601 expiresIn unchanged', async () => {
    const { transport, calls } = queueTransport([
      { status: 200, body: CREATE_OK_BODY },
      { status: 202, body: NOTIFY_OK_BODY },
    ]);
    const client = newClient(transport);
    await client.documents.send({ ...SEND_REQUEST, expiresIn: 'P14D' });
    const body = JSON.parse(calls[0]!.request.body);
    expect(body.ttl).toBe('P14D');
  });

  it('rejects degenerate ISO-8601 expiresIn at the SDK boundary', async () => {
    const { transport } = queueTransport([]);
    const client = newClient(transport);
    await expect(
      client.documents.send({ ...SEND_REQUEST, expiresIn: 'P' }),
    ).rejects.toBeInstanceOf(RapidSignError.ValidationError);
  });

  it('encodes shorthand expiresIn strings as ISO-8601 seconds', async () => {
    const { transport, calls } = queueTransport([
      { status: 200, body: CREATE_OK_BODY },
      { status: 202, body: NOTIFY_OK_BODY },
    ]);
    const client = newClient(transport);
    await client.documents.send({ ...SEND_REQUEST, expiresIn: '7d' });
    const body = JSON.parse(calls[0]!.request.body);
    expect(body.ttl).toBe('PT604800S');
  });
});

describe('documents.get', () => {
  it('parses a signed-document response into a typed Signature', async () => {
    const { transport, calls } = queueTransport([
      {
        status: 200,
        body: JSON.stringify({
          sign_id: 'sig_test_1',
          signature: Buffer.from('PNG-BYTES').toString('base64'),
          user_metadata: JSON.stringify({ ip: '198.51.100.42', user_agent: 'Mozilla/5.0' }),
          timestamp: 1_700_000_500,
        }),
      },
    ]);
    const client = newClient(transport);
    const sig = await client.documents.get('sig_test_1');
    expect(calls[0]!.request.url).toBe(`${TEST_BASE}/v1/documents/sig_test_1`);
    expect(calls[0]!.request.method).toBe('GET');
    expect(sig.signId).toBe('sig_test_1');
    expect(sig.signature.toString('utf8')).toBe('PNG-BYTES');
    expect(sig.signerIp).toBe('198.51.100.42');
    expect(sig.userAgent).toBe('Mozilla/5.0');
    expect(sig.signedAt.getTime()).toBe(1_700_000_500_000);
  });

  it('throws NotFound for an unknown sign id', async () => {
    const { transport } = queueTransport([{ status: 404, body: 'not found' }]);
    const client = newClient(transport);
    await expect(client.documents.get('sig_missing')).rejects.toBeInstanceOf(RapidSignError.NotFound);
  });

  it('rejects an empty signId at the SDK boundary', async () => {
    const { transport } = queueTransport([]);
    const client = newClient(transport);
    await expect(client.documents.get('')).rejects.toBeInstanceOf(RapidSignError.ValidationError);
  });

  it('forwards an optional session_id as a query parameter', async () => {
    const { transport, calls } = queueTransport([
      {
        status: 200,
        body: JSON.stringify({
          sign_id: 'sig_test_1',
          signature: 'AAAA',
          timestamp: 1,
        }),
      },
    ]);
    const client = newClient(transport);
    await client.documents.get('sig_test_1', 'sess_abc');
    expect(calls[0]!.request.url).toBe(`${TEST_BASE}/v1/documents/sig_test_1?session_id=sess_abc`);
  });
});

describe('documents.download', () => {
  it('decompresses a gzip+base64 PDF body transparently', async () => {
    const pdfBytes = 'fake-pdf-content';
    const { transport } = queueTransport([
      {
        status: 200,
        body: JSON.stringify({
          pdf_gzip_base64: gzipBase64(pdfBytes),
          compressed: true,
          size_bytes: pdfBytes.length,
        }),
      },
    ]);
    const client = newClient(transport);
    const buf = await client.documents.download('sig_test_1');
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.toString('utf8')).toBe(pdfBytes);
  });

  it('returns raw bytes when the server says compressed=false', async () => {
    const pdfBytes = 'raw-pdf';
    const { transport } = queueTransport([
      {
        status: 200,
        body: JSON.stringify({
          pdf_gzip_base64: Buffer.from(pdfBytes, 'utf8').toString('base64'),
          compressed: false,
        }),
      },
    ]);
    const client = newClient(transport);
    const buf = await client.documents.download('sig_test_1');
    expect(buf.toString('utf8')).toBe(pdfBytes);
  });


  it('retries transient 5xx errors on download', async () => {
    const pdfBytes = 'fake-pdf-content';
    const { transport, calls } = queueTransport([
      { status: 500, body: 'temporary fault' },
      {
        status: 200,
        body: JSON.stringify({
          pdf_gzip_base64: gzipBase64(pdfBytes),
          compressed: true,
        }),
      },
    ]);
    const { sleeper, sleeps } = instantSleeper();
    const client = new RapidSignClient(TEST_TOKEN, {
      baseUrl: TEST_BASE,
      transport,
      clock: FIXED_CLOCK,
      sleeper,
      uuid: counterUUID(),
      maxRetries: 1,
    });
    const buf = await client.documents.download('sig_test_1');
    expect(buf.toString('utf8')).toBe(pdfBytes);
    expect(calls).toHaveLength(2);
    expect(sleeps.length).toBeGreaterThanOrEqual(1);
  });

  it('throws NotFound when the document is not stored', async () => {
    const { transport } = queueTransport([{ status: 404, body: '' }]);
    const client = newClient(transport);
    await expect(client.documents.download('sig_missing')).rejects.toBeInstanceOf(RapidSignError.NotFound);
  });

  it('throws Unknown on a 200 with an unparseable body', async () => {
    const { transport } = queueTransport([{ status: 200, body: 'not-json' }]);
    const client = newClient(transport);
    await expect(client.documents.download('sig_test_1')).rejects.toBeInstanceOf(RapidSignError.Unknown);
  });
});

describe('documents.cancel', () => {
  it('throws NotImplemented with the tracking issue URL', async () => {
    const { transport } = queueTransport([]);
    const client = newClient(transport);
    await expect(
      client.documents.cancel('sig_test_1', { reason: 'applicant withdrew' }),
    ).rejects.toMatchObject({
      code: 'not_implemented',
      message: expect.stringContaining('issues/38'),
    });
  });

  it('still validates inputs even though the call is stubbed', async () => {
    const { transport } = queueTransport([]);
    const client = newClient(transport);
    await expect(
      client.documents.cancel('sig_test_1', { reason: '' }),
    ).rejects.toBeInstanceOf(RapidSignError.ValidationError);
  });
});
