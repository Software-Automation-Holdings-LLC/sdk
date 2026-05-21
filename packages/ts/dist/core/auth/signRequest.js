/**
 * Canonical session-signing helper.
 *
 * Produces the four headers required by the ISA Platform session-auth
 * verifier (`shared/go/auth/session/verifier.go`):
 *
 *   Authorization:     Bearer <sessionSecret>
 *   X-Isa-Session-Id:  <sessionId>
 *   X-Isa-Timestamp:   <iso8601_z>
 *   X-Isa-Signature:   hex(HMAC-SHA256(sessionSecret, canonicalString))
 *
 * The canonical string is byte-identical to `session.CanonicalString` in
 * the Go server package:
 *
 *   <METHOD>\n<path>\n<hex(sha256(body))>\n<timestamp>\n<sessionId>
 *
 * No trailing newline. The Go ground truth pins the bytes both sides hash.
 *
 * @see shared/go/auth/session/canonical.go (the source of truth)
 */
import { resolveSubtle, arrayBufferToHex } from '../internal/crypto';
const CONTEXT = 'SignRequest';
const PRECOMPUTED_EMPTY_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
const systemSignClock = () => new Date();
/**
 * Format `Date` as RFC 3339 UTC with a `Z` suffix (no milliseconds).
 * Matches `time.Time.Format(time.RFC3339)` in Go for UTC instants.
 */
export function formatTimestamp(d) {
    const pad = (n) => n.toString().padStart(2, '0');
    return (d.getUTCFullYear().toString() +
        '-' +
        pad(d.getUTCMonth() + 1) +
        '-' +
        pad(d.getUTCDate()) +
        'T' +
        pad(d.getUTCHours()) +
        ':' +
        pad(d.getUTCMinutes()) +
        ':' +
        pad(d.getUTCSeconds()) +
        'Z');
}
/**
 * Build the canonical signing string. Exported for cross-SDK parity
 * tests; callers should not need this directly.
 */
export async function canonicalString(method, path, body, timestamp, sessionId, subtle) {
    const bodyHashHex = await sha256Hex(body, subtle);
    return `${method.toUpperCase()}\n${path}\n${bodyHashHex}\n${timestamp}\n${sessionId}`;
}
async function sha256Hex(body, subtle) {
    const bytes = typeof body === 'string' ? new TextEncoder().encode(body) : body;
    if (bytes.length === 0)
        return PRECOMPUTED_EMPTY_SHA256;
    const cryptoSubtle = resolveSubtle(subtle, CONTEXT);
    const digest = await cryptoSubtle.digest('SHA-256', toArrayBuffer(bytes));
    return arrayBufferToHex(digest);
}
function toArrayBuffer(bytes) {
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    return copy.buffer;
}
async function hmacSha256Hex(secret, message, subtle) {
    const cryptoSubtle = resolveSubtle(subtle, CONTEXT);
    const encoder = new TextEncoder();
    const secretBytes = encoder.encode(secret);
    const key = await cryptoSubtle.importKey('raw', toArrayBuffer(secretBytes), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const messageBytes = encoder.encode(message);
    const sig = await cryptoSubtle.sign('HMAC', key, toArrayBuffer(messageBytes));
    return arrayBufferToHex(sig);
}
/**
 * Compute the canonical session-auth headers for a single outbound
 * request. The returned headers are byte-identical to what the Go
 * verifier expects — see the module doc comment for the wire shape.
 */
export async function signRequest(input) {
    if (!input.sessionId) {
        throw new Error(`${CONTEXT}: sessionId must be a non-empty string`);
    }
    if (!input.sessionSecret) {
        throw new Error(`${CONTEXT}: sessionSecret must be a non-empty string`);
    }
    const clock = input.clock ?? systemSignClock;
    const timestamp = formatTimestamp(clock());
    const canonical = await canonicalString(input.method, input.path, input.body, timestamp, input.sessionId, input.subtle);
    const signature = await hmacSha256Hex(input.sessionSecret, canonical, input.subtle);
    return {
        headers: {
            Authorization: `Bearer ${input.sessionSecret}`,
            'X-Isa-Session-Id': input.sessionId,
            'X-Isa-Timestamp': timestamp,
            'X-Isa-Signature': signature,
        },
    };
}
//# sourceMappingURL=signRequest.js.map