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

/** Envelope every method call resolves to on success. */
export interface Envelope<T> {
  /** Operation-specific result body. */
  data: T;
  /** Client-minted ULID echoed back by the server for correlation. */
  requestId: string;
  /** Idempotency key sent with this request (auto-minted or caller-supplied). */
  idempotencyKey: string;
  /** Server `livemode` flag; `false` for test-mode credentials. */
  livemode: boolean;
  /** Number of SDK retry attempts before this call succeeded. Zero on first-try. */
  retryAttempts: number;
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
