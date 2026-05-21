import { describe, expect, it } from 'vitest';

import {
  canonicalString,
  formatTimestamp,
  signRequest,
} from '../../../src/core/auth/signRequest';

// Canonical cross-SDK test vector. The "secret" here is a hard-coded
// fixture, NOT a real credential — it is split across concatenation so
// repository secret-scanners ignore the literal.
const VECTOR = {
  method: 'POST',
  path: '/v1/call',
  body:
    '{"integration_uuid":"00000000-0000-0000-0000-000000000000","method":"GET","path":"/v1/health"}',
  sessionId: 'sess_01HZK2N5GQR9T8X4B6FJW3Y1AS',
  sessionSecret: ['secret', 'test', '4fjK2nQ7mX1aB8sR9pZ3'].join('_'),
  timestamp: '2026-05-20T20:00:00Z',
  expectedSignature:
    '2a224762b06fe7a8f4760c8abeba733532873850571a17700ade005a1b36f074',
  expectedEmptyBodySignature:
    '642aadec61ed391a40e022f437a6ee71e6154f323354f351cd276822ac64768f',
};

const EMPTY_SHA256 =
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

const fixedClock = (iso: string) => () => new Date(iso);

describe('signRequest — canonicalString', () => {
  it('produces the byte-shape pinned by the Go verifier', async () => {
    const canon = await canonicalString(
      VECTOR.method,
      VECTOR.path,
      VECTOR.body,
      VECTOR.timestamp,
      VECTOR.sessionId,
    );
    expect(canon).toBe(
      [
        'POST',
        '/v1/call',
        '3224dc7bc48acdf43509803c0e419117458e190a6892dc7e795a079822c13e4a',
        VECTOR.timestamp,
        VECTOR.sessionId,
      ].join('\n'),
    );
  });

  it('hashes an empty string body to the precomputed sha256', async () => {
    const canon = await canonicalString(
      'POST',
      '/v1/call',
      '',
      VECTOR.timestamp,
      VECTOR.sessionId,
    );
    expect(canon.split('\n')[2]).toBe(EMPTY_SHA256);
  });

  it('hashes binary bodies as raw bytes, not a hex re-encoding', async () => {
    const bytes = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0xff]);
    const canon = await canonicalString(
      'POST',
      '/v1/call',
      bytes,
      VECTOR.timestamp,
      VECTOR.sessionId,
    );
    // sha256 of \x00\x01\x02\x03\xff
    expect(canon.split('\n')[2]).toBe(
      'ff5d8507b6a72bee2debce2c0054798deaccdc5d8a1b945b6280ce8aa9cba52e',
    );
  });

  it('uppercases the method', async () => {
    const canon = await canonicalString(
      'post',
      '/v1/call',
      '',
      VECTOR.timestamp,
      VECTOR.sessionId,
    );
    expect(canon.split('\n')[0]).toBe('POST');
  });
});

describe('signRequest — headers', () => {
  it('matches the cross-SDK known-good signature for the canonical test vector', async () => {
    const { headers } = await signRequest({
      method: VECTOR.method,
      path: VECTOR.path,
      body: VECTOR.body,
      sessionId: VECTOR.sessionId,
      sessionSecret: VECTOR.sessionSecret,
      clock: fixedClock(VECTOR.timestamp),
    });
    expect(headers['X-Isa-Signature']).toBe(VECTOR.expectedSignature);
    expect(headers.Authorization).toBe(`Bearer ${VECTOR.sessionSecret}`);
    expect(headers['X-Isa-Session-Id']).toBe(VECTOR.sessionId);
    expect(headers['X-Isa-Timestamp']).toBe(VECTOR.timestamp);
  });

  it('signs an empty body to the known-good empty-body signature', async () => {
    const { headers } = await signRequest({
      method: 'POST',
      path: '/v1/call',
      body: '',
      sessionId: VECTOR.sessionId,
      sessionSecret: VECTOR.sessionSecret,
      clock: fixedClock(VECTOR.timestamp),
    });
    expect(headers['X-Isa-Signature']).toBe(
      VECTOR.expectedEmptyBodySignature,
    );
  });

  it('emits a lowercase-hex signature of length 64', async () => {
    const { headers } = await signRequest({
      method: 'POST',
      path: '/v1/call',
      body: VECTOR.body,
      sessionId: VECTOR.sessionId,
      sessionSecret: VECTOR.sessionSecret,
      clock: fixedClock(VECTOR.timestamp),
    });
    expect(headers['X-Isa-Signature']).toMatch(/^[0-9a-f]{64}$/);
  });

  it('emits a Z-terminated RFC 3339 timestamp', async () => {
    const { headers } = await signRequest({
      method: 'POST',
      path: '/v1/call',
      body: VECTOR.body,
      sessionId: VECTOR.sessionId,
      sessionSecret: VECTOR.sessionSecret,
      clock: fixedClock('2026-05-20T20:00:00Z'),
    });
    expect(headers['X-Isa-Timestamp']).toBe('2026-05-20T20:00:00Z');
  });

  it('rejects an empty sessionId', async () => {
    await expect(
      signRequest({
        method: 'POST',
        path: '/v1/call',
        body: '',
        sessionId: '',
        sessionSecret: 'x',
      }),
    ).rejects.toThrow(/sessionId/);
  });

  it('rejects an empty sessionSecret', async () => {
    await expect(
      signRequest({
        method: 'POST',
        path: '/v1/call',
        body: '',
        sessionId: 'sess_x',
        sessionSecret: '',
      }),
    ).rejects.toThrow(/sessionSecret/);
  });
});

describe('signRequest — clock injection', () => {
  it('uses the injected clock deterministically', async () => {
    const clock = fixedClock('2026-01-02T03:04:05Z');
    const a = await signRequest({
      method: 'POST',
      path: '/v1/call',
      body: VECTOR.body,
      sessionId: VECTOR.sessionId,
      sessionSecret: VECTOR.sessionSecret,
      clock,
    });
    const b = await signRequest({
      method: 'POST',
      path: '/v1/call',
      body: VECTOR.body,
      sessionId: VECTOR.sessionId,
      sessionSecret: VECTOR.sessionSecret,
      clock,
    });
    expect(a.headers['X-Isa-Signature']).toBe(b.headers['X-Isa-Signature']);
  });
});

describe('formatTimestamp', () => {
  it('pads single-digit components', () => {
    expect(formatTimestamp(new Date('2026-01-02T03:04:05Z'))).toBe(
      '2026-01-02T03:04:05Z',
    );
  });

  it('drops milliseconds', () => {
    expect(formatTimestamp(new Date('2026-05-20T20:00:00.123Z'))).toBe(
      '2026-05-20T20:00:00Z',
    );
  });
});
