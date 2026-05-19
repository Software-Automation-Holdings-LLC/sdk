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
export declare const processEnv: EnvReader;
/** Default sink — writes to `process.stderr` when present. */
export declare const stderrSink: LogSink;
/** Redact sensitive headers in-place safe (returns a new object). */
export declare function redactHeaders(headers: Record<string, string>): Record<string, string>;
/**
 * Redact PII fields recursively in a parsed JSON body. Returns a new value;
 * the input is not mutated. Non-object inputs are returned unchanged.
 */
export declare function redactBody(value: unknown): unknown;
/**
 * Redact PII in a serialized JSON body string. Non-JSON strings are
 * returned unchanged so non-JSON wire forms (form-encoded license bodies)
 * are not corrupted; the caller may pass `kind: 'form'` to opt into
 * form-field redaction.
 */
export declare function redactBodyString(body: string, kind?: 'json' | 'form' | 'unknown'): string;
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
export declare function debugLoggerFromEnv(env?: EnvReader, sink?: LogSink): DebugLogger | undefined;
/** Build a debug logger that writes to the given sink. */
export declare function makeLogger(sink: LogSink): DebugLogger;
//# sourceMappingURL=logger.d.ts.map