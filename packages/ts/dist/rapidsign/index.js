/**
 * @isa-sdk/rapidsign — Tier 3 RapidSign facade.
 *
 * Public exports:
 *   - `RapidSignClient`   — primary entrypoint
 *   - `RapidSignError`    — error base + specific subclasses
 *   - Value types         — `Envelope`, `Signature`, `Recipient`, `PdfSource`,
 *                           `SendRequest`, `CancelRequest`, `AwaitOpts`
 *   - Facade types        — `Transport`, `Clock`, `Sleeper`, `UUIDGenerator`,
 *                           `Decompressor` for tests + advanced usage
 *
 * Cross-language naming: these names are the spec the Go and PHP agents
 * mirror with their language casing. Renames are breaking.
 */
export { RapidSignClient, DEFAULT_RAPIDSIGN_BASE_URL, DEFAULT_USER_AGENT, DEFAULT_MAX_RETRIES, } from './client.js';
export { RapidSignError, fromHttpResponse, fromProblemDetails, } from './errors.js';
export { DocumentsService } from './documents.js';
export { WebhooksService } from './webhooks.js';
export { defaultTransport, } from './internal/transport.js';
export { defaultDecompressor, decodeGzipBase64, } from './internal/decompress.js';
export { defaultUUIDGenerator, defaultSleeper, systemClock, } from './internal/random.js';
export { parseDuration, MAX_DURATION_MS } from './internal/duration.js';
//# sourceMappingURL=index.js.map