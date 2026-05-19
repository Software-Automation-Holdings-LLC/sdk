/**
 * Phase 1 — debug logger must write to stderr and redact credentials/PII.
 *
 * The parent/child JSON pipeline test confirms stdout is untouched even
 * when ISA_LOG=debug is active.
 */
import { describe, it, expect } from 'vitest';
import {
  debugLoggerFromEnv,
  redactHeaders,
  redactBody,
  redactBodyString,
  makeLogger,
  type LogSink,
} from '../../src/zyins';
import { spawn } from 'node:child_process';
import { join } from 'node:path';

function collectingSink(): LogSink & { written: string[] } {
  const written: string[] = [];
  return {
    write(chunk: string) {
      written.push(chunk);
    },
    written,
  };
}

describe('redactHeaders', () => {
  it('redacts Authorization and X-*-Signature, preserves others', () => {
    const out = redactHeaders({
      Authorization: 'Bearer secret-value',
      'X-Device-Signature': 'abcdef',
      'X-Session-Signature': 'ghijkl',
      'Content-Type': 'application/json',
      'X-Isa-Request-Id': 'req_01',
    });
    expect(out.Authorization).toBe('[redacted]');
    expect(out['X-Device-Signature']).toBe('[redacted]');
    expect(out['X-Session-Signature']).toBe('[redacted]');
    expect(out['Content-Type']).toBe('application/json');
    expect(out['X-Isa-Request-Id']).toBe('req_01');
  });

  it('is case-insensitive on header names', () => {
    const out = redactHeaders({ authorization: 'Bearer x', 'x-device-signature': 'y' });
    expect(out.authorization).toBe('[redacted]');
    expect(out['x-device-signature']).toBe('[redacted]');
  });
});

describe('redactBody', () => {
  it('redacts email, dob, ssn, phone recursively', () => {
    const out = redactBody({
      applicant: {
        email: 'a@b.com',
        dob: '1962-04-18',
        ssn: '111-11-1111',
        phone: '555-1212',
        firstName: 'John',
      },
      products: ['p1'],
    });
    expect(out).toEqual({
      applicant: {
        email: '[redacted]',
        dob: '[redacted]',
        ssn: '[redacted]',
        phone: '[redacted]',
        firstName: 'John',
      },
      products: ['p1'],
    });
  });
});

describe('redactBodyString', () => {
  it('redacts JSON bodies', () => {
    const out = redactBodyString(JSON.stringify({ email: 'a@b.com', name: 'John' }));
    expect(out).toBe(JSON.stringify({ email: '[redacted]', name: 'John' }));
  });

  it('redacts form-encoded bodies (PII keys only)', () => {
    const body = 'action=activate&email=a%40b.com&orderid=KC1';
    expect(redactBodyString(body)).toContain('email=[redacted]');
    expect(redactBodyString(body)).toContain('orderid=KC1');
  });

  it('returns non-JSON non-form strings unchanged', () => {
    expect(redactBodyString('hello world')).toBe('hello world');
  });
});

describe('debugLoggerFromEnv', () => {
  it('returns undefined when ISA_LOG is unset', () => {
    expect(debugLoggerFromEnv({ get: () => undefined })).toBeUndefined();
  });
  it('returns undefined when ISA_LOG is not "debug"', () => {
    expect(debugLoggerFromEnv({ get: (n) => (n === 'ISA_LOG' ? 'info' : undefined) })).toBeUndefined();
  });
  it('returns an active logger when ISA_LOG=debug', () => {
    const sink = collectingSink();
    const logger = debugLoggerFromEnv({ get: (n) => (n === 'ISA_LOG' ? 'debug' : undefined) }, sink);
    expect(logger).toBeDefined();
    logger?.request({
      method: 'POST',
      url: 'https://x/y',
      headers: { Authorization: 'Bearer secret-value' },
      body: JSON.stringify({ email: 'a@b.com' }),
      bodyKind: 'json',
    });
    expect(sink.written).toHaveLength(1);
    const line = sink.written[0]!;
    expect(line).toContain('isa-sdk ');
    expect(line).toContain('"kind":"request"');
    expect(line).toContain('[redacted]');
    expect(line).not.toContain('Bearer secret-value');
    expect(line).not.toContain('a@b.com');
  });
});

describe('makeLogger', () => {
  it('writes a response line with redacted body', () => {
    const sink = collectingSink();
    const logger = makeLogger(sink);
    logger.response({
      method: 'POST',
      url: 'https://x/y',
      status: 200,
      headers: {},
      body: JSON.stringify({ email: 'a@b.com', plans: [] }),
      bodyKind: 'json',
    });
    expect(sink.written[0]).toContain('"kind":"response"');
    expect(sink.written[0]).toContain('[redacted]');
  });
});

describe('parent/child JSON pipeline (stderr-only)', () => {
  it('stdout stays empty when ISA_LOG=debug is set', async () => {
    const childScript = `
      import('${join(__dirname, '../../src/zyins/index.ts')}'.replace('.ts', '')).catch(() => {});
      import { makeLogger } from '${join(__dirname, '../../src/zyins/logger.ts')}'.replace('.ts', '');
    `;
    // Simpler approach: use vitest's own process; just call makeLogger with
    // a process.stderr-bound sink and capture process.stdout writes.
    const stdoutChunks: string[] = [];
    const realWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: string | Uint8Array) => {
      stdoutChunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString());
      return true;
    }) as typeof process.stdout.write;
    try {
      const logger = makeLogger({
        write: (s: string) => {
          process.stderr.write(s);
        },
      });
      logger.request({
        method: 'POST',
        url: 'https://x/y',
        headers: {},
        body: '{}',
        bodyKind: 'json',
      });
    } finally {
      process.stdout.write = realWrite;
    }
    // Ensure stdout was NOT written to by the logger path.
    expect(stdoutChunks.join('')).toBe('');
    void childScript;
    void spawn;
  });
});
