/**
 * Shared test fixtures + helpers (persona discipline per packages/rapidsign/js/README.md).
 *
 * Test data uses the project's persona set: John Doe / NC / agency-style
 * email. Token values mimic the unified `isa_*` shape.
 */

import { gzipSync } from 'node:zlib';
import type { Transport, TransportRequest, TransportResponse } from '../../src/rapidsign/internal/transport';
import type { Sleeper, UUIDGenerator } from '../../src/rapidsign/internal/random';

export const TEST_TOKEN = 'isa_test_4fjK2nQ7mX1aB8sR9pZ3';
export const TEST_BASE = 'https://test.rapidsign.isaapi.local';
export const FIXED_NOW = 1_700_000_000_000;
export const FIXED_CLOCK = (): number => FIXED_NOW;

/** Deterministic UUID generator — counts up so each call is unique. */
export function counterUUID(): UUIDGenerator {
  let n = 0;
  return () => {
    n += 1;
    const hex = n.toString(16).padStart(12, '0');
    return `00000000-0000-4000-8000-${hex}`;
  };
}

/** Captured call for assertion. */
export interface CapturedCall {
  request: TransportRequest;
}

/**
 * Build a transport that returns a queue of canned responses in order.
 * The default 404 response is returned after the queue is exhausted, so
 * `awaitSignature` tests can pin "still pending" forever.
 */
export function queueTransport(
  responses: ReadonlyArray<Partial<TransportResponse>>,
): { transport: Transport; calls: CapturedCall[] } {
  const calls: CapturedCall[] = [];
  let i = 0;
  const transport: Transport = async (request) => {
    calls.push({ request });
    const raw = responses[i] ?? { status: 404, body: '', headers: {} };
    i += 1;
    return {
      status: raw.status ?? 200,
      body: raw.body ?? '',
      headers: raw.headers ?? {},
    };
  };
  return { transport, calls };
}

/** A sleeper that resolves synchronously and records its calls. */
export function instantSleeper(): { sleeper: Sleeper; sleeps: number[] } {
  const sleeps: number[] = [];
  const sleeper: Sleeper = async (ms, signal) => {
    sleeps.push(ms);
    if (signal?.aborted) {
      const err = new Error('aborted');
      err.name = 'AbortError';
      throw err;
    }
  };
  return { sleeper, sleeps };
}

/** Build a base64-encoded gzip of `input` for download-test fixtures. */
export function gzipBase64(input: string): string {
  return gzipSync(Buffer.from(input, 'utf8')).toString('base64');
}

/** Standard "happy path" Create response. */
export const CREATE_OK_BODY = JSON.stringify({
  packet_stored: true,
  hashes: { 'https://example.com/a.pdf': 'abc123' },
  sign_ids: ['sig_test_1'],
  view_only_id: 'view_test_1',
  document_id: 'doc_test_1',
  sign_url: 'https://sign.example/sig_test_1',
  view_url: 'https://view.example/view_test_1',
  created_at: '2026-05-15T14:32:01Z',
  expires_at: '2026-06-14T14:32:01Z',
});

/** Standard Notify response. */
export const NOTIFY_OK_BODY = JSON.stringify({
  sign_id: 'sig_test_1',
  status: 'DOCUMENT_STATUS_NOTIFIED',
});

export const SEND_REQUEST = {
  packet: [{ url: 'https://example.com/a.pdf' }],
  recipient: { email: 'john.doe@acme-agency.com', name: 'John Doe' },
  legalText: 'I agree to the terms above.',
  metadata: { applicationId: 'app_1234' },
} as const;
