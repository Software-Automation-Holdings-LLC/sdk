/**
 * Response envelope (SDK_DESIGN.md §4.6).
 *
 * Every successful method call returns an `Envelope<T>` whose typed named
 * fields surface the correlation, idempotency, and retry metadata that the
 * server returned. This is the type contract the SDK consumer holds.
 *
 * Field naming follows the TypeScript idiom (camelCase). Wire form is
 * snake_case; the conversion happens at the parse boundary so call sites
 * never see snake_case spelling.
 */
/**
 * Envelope every method call resolves to on success.
 *
 * The locked-spec surface (per `/tmp/sdk-syntax-proposal.md` §2.3 + post-lock
 * correction #1) exposes correlation metadata as underscore-prefixed siblings
 * on the data return value (OpenAI SDK pattern). The legacy `data` + bare
 * `requestId` / `idempotencyKey` fields are retained as `@deprecated` aliases
 * during the migration window so existing consumers (PR #223 / #226) keep
 * working. New code SHOULD read `result._requestId` / `result._idempotencyKey`.
 */
export interface Envelope<T> {
    /**
     * Operation-specific result body.
     *
     * @deprecated Per the locked-spec underscore-prop pattern, methods return
     * the data directly; consumers SHOULD read result fields and the
     * underscore-prefixed metadata (`_requestId`, `_idempotencyKey`) without
     * unwrapping `.data`. Retained for backward compatibility.
     */
    data: T;
    /** @deprecated Use `_requestId` (underscore-prefix) per the locked-spec pattern. */
    requestId: string;
    /** @deprecated Use `_idempotencyKey` (underscore-prefix) per the locked-spec pattern. */
    idempotencyKey: string;
    /** Server `livemode` flag; `false` for test-mode credentials. */
    livemode: boolean;
    /** Number of SDK retry attempts before this call succeeded. Zero on first-try. */
    retryAttempts: number;
    /** Client-minted ULID echoed back by the server for correlation. */
    _requestId: string;
    /** Idempotency key sent with this request (auto-minted or caller-supplied). */
    _idempotencyKey: string;
}
/** Raw HTTP response surfaced by `.withRawResponse()` variants. */
export interface RawResponse {
    /** HTTP status code. */
    status: number;
    /** Response headers, lowercased keys. */
    headers: Record<string, string>;
    /** Final URL after any redirects (or the request URL when no redirect). */
    url: string;
}
/** Result of `.withRawResponse()` — typed data plus the raw HTTP envelope. */
export interface RawResponseResult<T> {
    data: T;
    response: RawResponse;
}
//# sourceMappingURL=envelope.d.ts.map