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
/** Default env reader — reads from `process.env`. */
export const processEnv = {
    get(name) {
        // `globalThis.process` is undefined in pure-browser builds; the SDK
        // tolerates that — debug logging just turns off rather than throwing.
        const env = globalThis.process
            ?.env;
        return env?.[name];
    },
};
/** Default sink — writes to `process.stderr` when present. */
export const stderrSink = {
    write(chunk) {
        const proc = globalThis
            .process;
        proc?.stderr?.write?.(chunk);
    },
};
/** Header names whose values are always redacted. */
const REDACT_HEADER_NAMES = new Set([
    'authorization',
    'x-device-signature',
    'x-session-signature',
    'cookie',
    'set-cookie',
].map((h) => h.toLowerCase()));
/** Body fields whose values are always redacted. */
const REDACT_BODY_FIELDS = new Set(['email', 'dob', 'ssn', 'phone']);
const REDACTED = '[redacted]';
/** Redact sensitive headers in-place safe (returns a new object). */
export function redactHeaders(headers) {
    const out = {};
    for (const [name, value] of Object.entries(headers)) {
        out[name] = REDACT_HEADER_NAMES.has(name.toLowerCase()) ? REDACTED : value;
    }
    return out;
}
/**
 * Redact PII fields recursively in a parsed JSON body. Returns a new value;
 * the input is not mutated. Non-object inputs are returned unchanged.
 */
export function redactBody(value) {
    if (Array.isArray(value)) {
        return value.map((entry) => redactBody(entry));
    }
    if (value !== null && typeof value === 'object') {
        const out = {};
        for (const [key, child] of Object.entries(value)) {
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
export function redactBodyString(body, kind = 'unknown') {
    if (kind === 'form' || (kind === 'unknown' && body.includes('=') && !body.startsWith('{'))) {
        return redactFormBody(body);
    }
    if (!body.startsWith('{') && !body.startsWith('['))
        return body;
    try {
        const parsed = JSON.parse(body);
        return JSON.stringify(redactBody(parsed));
    }
    catch {
        return body;
    }
}
function redactFormBody(body) {
    return body
        .split('&')
        .map((pair) => {
        const eq = pair.indexOf('=');
        if (eq < 0)
            return pair;
        const key = pair.slice(0, eq);
        const decoded = (() => {
            try {
                return decodeURIComponent(key).toLowerCase();
            }
            catch {
                return key.toLowerCase();
            }
        })();
        if (REDACT_BODY_FIELDS.has(decoded))
            return `${key}=${REDACTED}`;
        return pair;
    })
        .join('&');
}
/** Construct a debug logger from environment configuration. */
export function debugLoggerFromEnv(env = processEnv, sink = stderrSink) {
    const level = env.get('ISA_LOG');
    if (level !== 'debug')
        return undefined;
    return makeLogger(sink);
}
/** Build a debug logger that writes to the given sink. */
export function makeLogger(sink) {
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
//# sourceMappingURL=logger.js.map