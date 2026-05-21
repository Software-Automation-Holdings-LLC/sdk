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
/**
 * Clock seam — defaults to the system wall clock. Returns a Date so the
 * helper can format an RFC 3339 UTC timestamp with a trailing `Z`.
 */
export type SignClock = () => Date;
/** Inputs to {@link signRequest}. */
export interface SignRequestInput {
    /** HTTP method (will be normalized to uppercase). */
    method: string;
    /** Request path including query string; no host. */
    path: string;
    /** Raw body bytes. A string is encoded UTF-8 before hashing. */
    body: string | Uint8Array;
    /** Session id (`sess_…`). Travels in `X-Isa-Session-Id`. */
    sessionId: string;
    /** HMAC key. Travels as `Authorization: Bearer <secret>`. */
    sessionSecret: string;
    /** Injectable clock. Defaults to `() => new Date()`. */
    clock?: SignClock;
    /** Optional SubtleCrypto injection (for non-browser/Node environments). */
    subtle?: SubtleCrypto;
}
/** Headers emitted by {@link signRequest}. */
export interface SignRequestHeaders {
    Authorization: string;
    'X-Isa-Session-Id': string;
    'X-Isa-Timestamp': string;
    'X-Isa-Signature': string;
}
/** Output of {@link signRequest}. */
export interface SignRequestResult {
    headers: SignRequestHeaders;
}
/**
 * Format `Date` as RFC 3339 UTC with a `Z` suffix (no milliseconds).
 * Matches `time.Time.Format(time.RFC3339)` in Go for UTC instants.
 */
export declare function formatTimestamp(d: Date): string;
/**
 * Build the canonical signing string. Exported for cross-SDK parity
 * tests; callers should not need this directly.
 */
export declare function canonicalString(method: string, path: string, body: string | Uint8Array, timestamp: string, sessionId: string, subtle?: SubtleCrypto): Promise<string>;
/**
 * Compute the canonical session-auth headers for a single outbound
 * request. The returned headers are byte-identical to what the Go
 * verifier expects — see the module doc comment for the wire shape.
 */
export declare function signRequest(input: SignRequestInput): Promise<SignRequestResult>;
//# sourceMappingURL=signRequest.d.ts.map