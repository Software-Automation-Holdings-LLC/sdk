/**
 * Debug logger (SDK_DESIGN.md §7.1).
 *
 * When `ISA_LOG=debug` is set in the environment, every request and response
 * is dumped to **stderr** (NEVER stdout). Credentials and PII are redacted
 * before the line is emitted.
 *
 * Stdout is reserved for caller program output — leaking the SDK's debug
 * lines there breaks parent/child JSON pipelines (Anthropic's SDK has a
 * known bug doing exactly this; we will not reproduce it).
 *
 * The logger is injectable. Tests pass a custom `WriteStream`-shaped facade
 * (`{ write: (s: string) => void }`) so they can assert exact output without
 * touching `process.stderr`.
 */

/** Minimal stream sink the logger writes to. Matches Node's WriteStream. */
export interface LogSink {
  write(chunk: string): void;
}

/** Environment reader, injectable for tests. */
export interface EnvReader {
  get(name: string): string | undefined;
}

/** Default env reader — reads from `process.env`. */
export const processEnv: EnvReader = {
  get(name) {
    // `globalThis.process` is undefined in pure-browser builds; the SDK
    // tolerates that — debug logging just turns off rather than throwing.
    const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
      ?.env;
    return env?.[name];
  },
};

/** Default sink — writes to `process.stderr` when present. */
export const stderrSink: LogSink = {
  write(chunk) {
    const proc = (globalThis as { process?: { stderr?: { write?: (s: string) => void } } })
      .process;
    proc?.stderr?.write?.(chunk);
  },
};

/** Header names whose values are always redacted. */
const REDACT_HEADER_NAMES = new Set(
  [
    'authorization',
    'x-device-signature',
    'x-session-signature',
    'cookie',
    'set-cookie',
  ].map((h) => h.toLowerCase()),
);

/** Body fields whose values are always redacted. */
const REDACT_BODY_FIELDS = new Set(['email', 'dob', 'ssn', 'phone']);

const REDACTED = '[redacted]';

/** Redact sensitive headers in-place safe (returns a new object). */
export function redactHeaders(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    out[name] = REDACT_HEADER_NAMES.has(name.toLowerCase()) ? REDACTED : value;
  }
  return out;
}

/**
 * Redact PII fields recursively in a parsed JSON body. Returns a new value;
 * the input is not mutated. Non-object inputs are returned unchanged.
 */
export function redactBody(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => redactBody(entry));
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      out[key] = REDACT_BODY_FIELDS.has(key.toLowerCase()) ? REDACTED : redactBody(child);
    }
    return out;
  }
  return value;
}

/**
 * Redact PII in a serialized JSON body string. Non-JSON strings are
 * returned unchanged so non-JSON wire forms (form-encoded license bodies)
 * are not corrupted; the caller may pass `kind: 'form'` to opt into
 * form-field redaction.
 */
export function redactBodyString(body: string, kind: 'json' | 'form' | 'unknown' = 'unknown'): string {
  if (kind === 'form' || (kind === 'unknown' && body.includes('=') && !body.startsWith('{'))) {
    return redactFormBody(body);
  }
  if (!body.startsWith('{') && !body.startsWith('[')) return body;
  try {
    const parsed: unknown = JSON.parse(body);
    return JSON.stringify(redactBody(parsed));
  } catch {
    return body;
  }
}

function redactFormBody(body: string): string {
  return body
    .split('&')
    .map((pair) => {
      const eq = pair.indexOf('=');
      if (eq < 0) return pair;
      const key = pair.slice(0, eq);
      const decoded = (() => {
        try {
          return decodeURIComponent(key).toLowerCase();
        } catch {
          return key.toLowerCase();
        }
      })();
      if (REDACT_BODY_FIELDS.has(decoded)) return `${key}=${REDACTED}`;
      return pair;
    })
    .join('&');
}

/** Debug logger emitting redacted request/response records to a sink. */
export interface DebugLogger {
  request(record: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body: string;
    bodyKind?: 'json' | 'form' | 'unknown';
    retryAttempt?: number;
  }): void;
  response(record: {
    method: string;
    url: string;
    status: number;
    headers: Record<string, string>;
    body: string;
    bodyKind?: 'json' | 'form' | 'unknown';
    retryAttempt?: number;
  }): void;
}

/** Construct a debug logger from environment configuration. */
export function debugLoggerFromEnv(
  env: EnvReader = processEnv,
  sink: LogSink = stderrSink,
): DebugLogger | undefined {
  const level = env.get('ISA_LOG');
  if (level !== 'debug') return undefined;
  return makeLogger(sink);
}

/** Build a debug logger that writes to the given sink. */
export function makeLogger(sink: LogSink): DebugLogger {
  return {
    request({ method, url, headers, body, bodyKind, retryAttempt }) {
      const line = JSON.stringify({
        ts: new Date().toISOString(),
        kind: 'request',
        method,
        url,
        headers: redactHeaders(headers),
        body: redactBodyString(body, bodyKind ?? 'unknown'),
        ...(retryAttempt !== undefined && { retryAttempt }),
      });
      sink.write(`isa-sdk ${line}\n`);
    },
    response({ method, url, status, headers, body, bodyKind, retryAttempt }) {
      const line = JSON.stringify({
        ts: new Date().toISOString(),
        kind: 'response',
        method,
        url,
        status,
        headers: redactHeaders(headers),
        body: redactBodyString(body, bodyKind ?? 'unknown'),
        ...(retryAttempt !== undefined && { retryAttempt }),
      });
      sink.write(`isa-sdk ${line}\n`);
    },
  };
}
