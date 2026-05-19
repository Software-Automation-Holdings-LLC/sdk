import { describe, expect, it } from 'vitest';
import { RapidSignClient } from '../../src/rapidsign/client';
import { RapidSignError } from '../../src/rapidsign/errors';
import {
  FIXED_NOW,
  TEST_BASE,
  TEST_TOKEN,
  counterUUID,
  instantSleeper,
  queueTransport,
} from './fixtures';

const STORED_PROBE = {
  status: 200,
  body: JSON.stringify({ pdf_gzip_base64: 'AAAA', compressed: false }),
};

const SIGNED_BODY = JSON.stringify({
  sign_id: 'sig_test_1',
  signature: Buffer.from('SIG').toString('base64'),
  user_metadata: JSON.stringify({ ip: '198.51.100.42', user_agent: 'Mozilla/5.0' }),
  timestamp: 1_700_000_500,
});

describe('documents.awaitSignature', () => {
  it('returns immediately when the document is already signed', async () => {
    const { transport, calls } = queueTransport([{ status: 200, body: SIGNED_BODY }]);
    const { sleeper, sleeps } = instantSleeper();
    const client = new RapidSignClient(TEST_TOKEN, {
      baseUrl: TEST_BASE,
      transport,
      clock: () => FIXED_NOW,
      sleeper,
      uuid: counterUUID(),
      maxRetries: 0,
    });
    const sig = await client.documents.awaitSignature('sig_test_1');
    expect(sig.signId).toBe('sig_test_1');
    expect(calls).toHaveLength(1);
    expect(sleeps).toHaveLength(0);
  });


  it('fails fast when no document is stored for the sign id', async () => {
    const { transport, calls } = queueTransport([
      { status: 404, body: '' },
      { status: 404, body: '' },
    ]);
    const { sleeper, sleeps } = instantSleeper();
    const client = new RapidSignClient(TEST_TOKEN, {
      baseUrl: TEST_BASE,
      transport,
      clock: () => FIXED_NOW,
      sleeper,
      uuid: counterUUID(),
      maxRetries: 0,
    });
    await expect(client.documents.awaitSignature('sig_missing')).rejects.toMatchObject({
      code: 'not_found',
      message: expect.stringContaining('no document stored'),
    });
    expect(calls).toHaveLength(2);
    expect(calls[0]!.request.url).toBe(`${TEST_BASE}/v1/documents/sig_missing`);
    expect(calls[1]!.request.url).toBe(`${TEST_BASE}/v1/documents/sig_missing/download`);
    expect(sleeps).toHaveLength(0);
  });

  it('polls past 404s until a signature arrives', async () => {
    const { transport, calls } = queueTransport([
      { status: 404, body: '' },
      {
        status: 200,
        body: JSON.stringify({ pdf_gzip_base64: 'AAAA', compressed: false }),
      },
      { status: 404, body: '' },
      { status: 200, body: SIGNED_BODY },
    ]);
    const { sleeper, sleeps } = instantSleeper();
    const client = new RapidSignClient(TEST_TOKEN, {
      baseUrl: TEST_BASE,
      transport,
      clock: () => FIXED_NOW,
      sleeper,
      uuid: counterUUID(),
      maxRetries: 0,
    });
    const sig = await client.documents.awaitSignature('sig_test_1');
    expect(sig.signId).toBe('sig_test_1');
    expect(calls).toHaveLength(4);
    expect(sleeps).toHaveLength(2);
    // First sleep around 2s base; second sleep around 4s.
    expect(sleeps[0]!).toBeGreaterThan(1_000);
    expect(sleeps[0]!).toBeLessThan(3_000);
    expect(sleeps[1]!).toBeGreaterThan(2_500);
    expect(sleeps[1]!).toBeLessThan(5_500);
  });

  it('caps the polling delay at 30 seconds', async () => {
    const responses = [{ status: 404, body: '' }, STORED_PROBE];
    responses.push(...Array.from({ length: 11 }, () => ({ status: 404, body: '' })));
    responses.push({ status: 200, body: SIGNED_BODY });
    const { transport } = queueTransport(responses);
    const { sleeper, sleeps } = instantSleeper();
    let elapsed = 0;
    const client = new RapidSignClient(TEST_TOKEN, {
      baseUrl: TEST_BASE,
      transport,
      // Advance the clock past each sleep so the next iteration sees more elapsed time.
      clock: () => FIXED_NOW + elapsed,
      sleeper: async (ms, signal) => {
        elapsed += ms;
        return sleeper(ms, signal);
      },
      uuid: counterUUID(),
      maxRetries: 0,
    });
    await client.documents.awaitSignature('sig_test_1', { timeout: '1h' });
    // Once attempt is high enough, every recorded sleep should be <= 30s + jitter.
    for (const s of sleeps) {
      expect(s).toBeLessThanOrEqual(30_000 * 1.3);
    }
  });

  it('throws DeadlineExceeded when the timeout elapses without a signature', async () => {
    const responses = [{ status: 404, body: '' }, STORED_PROBE, ...Array.from({ length: 4 }, () => ({ status: 404, body: '' }))];
    const { transport } = queueTransport(responses);
    let elapsed = 0;
    const client = new RapidSignClient(TEST_TOKEN, {
      baseUrl: TEST_BASE,
      transport,
      clock: () => FIXED_NOW + elapsed,
      sleeper: async (ms) => {
        elapsed += ms;
      },
      uuid: counterUUID(),
      maxRetries: 0,
    });
    await expect(
      client.documents.awaitSignature('sig_test_1', { timeout: '3s' }),
    ).rejects.toBeInstanceOf(RapidSignError.DeadlineExceeded);
  });

  it('aborts immediately when AbortSignal fires before the call', async () => {
    const { transport, calls } = queueTransport([]);
    const { sleeper } = instantSleeper();
    const client = new RapidSignClient(TEST_TOKEN, {
      baseUrl: TEST_BASE,
      transport,
      clock: () => FIXED_NOW,
      sleeper,
      uuid: counterUUID(),
      maxRetries: 0,
    });
    const controller = new AbortController();
    controller.abort();
    await expect(
      client.documents.awaitSignature('sig_test_1', { signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(calls).toHaveLength(0);
  });

  it('aborts while sleeping between polls', async () => {
    const { transport } = queueTransport([
      { status: 404, body: '' },
      STORED_PROBE,
      { status: 404, body: '' },
    ]);
    const controller = new AbortController();
    const sleeper = async (_ms: number, signal?: AbortSignal): Promise<void> => {
      controller.abort();
      if (signal?.aborted) {
        const e = new Error('aborted');
        e.name = 'AbortError';
        throw e;
      }
    };
    const client = new RapidSignClient(TEST_TOKEN, {
      baseUrl: TEST_BASE,
      transport,
      clock: () => FIXED_NOW,
      sleeper,
      uuid: counterUUID(),
      maxRetries: 0,
    });
    await expect(
      client.documents.awaitSignature('sig_test_1', { signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('retries transient 5xx errors during polling before giving up', async () => {
    const { transport, calls } = queueTransport([
      { status: 500, body: 'temporary fault' },
      { status: 200, body: SIGNED_BODY },
    ]);
    const { sleeper, sleeps } = instantSleeper();
    const client = new RapidSignClient(TEST_TOKEN, {
      baseUrl: TEST_BASE,
      transport,
      clock: () => FIXED_NOW,
      sleeper,
      uuid: counterUUID(),
      maxRetries: 1,
    });
    const sig = await client.documents.awaitSignature('sig_test_1');
    expect(sig.signId).toBe('sig_test_1');
    expect(calls).toHaveLength(2);
    expect(sleeps.length).toBeGreaterThanOrEqual(1);
  });

  it('continues polling when download probe returns a retryable server error', async () => {
    const { transport, calls } = queueTransport([
      { status: 404, body: '' },
      { status: 500, body: 'temporary fault' },
      { status: 404, body: '' },
      STORED_PROBE,
      { status: 404, body: '' },
      { status: 200, body: SIGNED_BODY },
    ]);
    const { sleeper, sleeps } = instantSleeper();
    const client = new RapidSignClient(TEST_TOKEN, {
      baseUrl: TEST_BASE,
      transport,
      clock: () => FIXED_NOW,
      sleeper,
      uuid: counterUUID(),
      maxRetries: 0,
    });
    const sig = await client.documents.awaitSignature('sig_test_1');
    expect(sig.signId).toBe('sig_test_1');
    expect(calls.length).toBeGreaterThanOrEqual(3);
    expect(sleeps.length).toBeGreaterThanOrEqual(1);
  });

  it('propagates non-retryable download probe errors immediately', async () => {
    const { transport, calls } = queueTransport([
      { status: 404, body: '' },
      { status: 403, body: 'forbidden' },
    ]);
    const { sleeper } = instantSleeper();
    const client = new RapidSignClient(TEST_TOKEN, {
      baseUrl: TEST_BASE,
      transport,
      clock: () => FIXED_NOW,
      sleeper,
      uuid: counterUUID(),
      maxRetries: 0,
    });
    await expect(client.documents.awaitSignature('sig_test_1')).rejects.toBeInstanceOf(
      RapidSignError.Forbidden,
    );
    expect(calls).toHaveLength(2);
  });

  it('propagates non-404 errors immediately instead of polling through them', async () => {
    const { transport, calls } = queueTransport([{ status: 403, body: 'forbidden' }]);
    const { sleeper } = instantSleeper();
    const client = new RapidSignClient(TEST_TOKEN, {
      baseUrl: TEST_BASE,
      transport,
      clock: () => FIXED_NOW,
      sleeper,
      uuid: counterUUID(),
      maxRetries: 0,
    });
    await expect(client.documents.awaitSignature('sig_test_1')).rejects.toBeInstanceOf(
      RapidSignError.Forbidden,
    );
    expect(calls).toHaveLength(1);
  });
});
