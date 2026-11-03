/**
 * @isa-sdk/rapidsign — Tier 3 RapidSign facade.
 *
 * Public exports:
 *   - `RapidSignClient`   — primary entrypoint
 *   - `RapidSignError`    — error base + specific subclasses
 *   - Value types         — `Envelope`, `Signature`, `Recipient`, `PdfSource`,
 *                           `SendRequest`, `CancelRequest`, `AwaitOpts`
 *   - Voice types         — `VoiceStep`, `VoiceStepKind`, `VoiceScript`,
 *                           `MintCodeRequest`, `VoiceCode` (see `client.voice`)
 *   - Facade types        — `Transport`, `Clock`, `Sleeper`, `UUIDGenerator`,
 *                           `Decompressor` for tests + advanced usage
 *
 * Cross-language naming: these names are the spec the Go and PHP agents
 * mirror with their language casing. Renames are breaking.
 */
export { DEFAULT_MAX_RETRIES, DEFAULT_RAPIDSIGN_BASE_URL, DEFAULT_USER_AGENT, RapidSignClient, } from "./client.js";
export { fromHttpResponse, fromProblemDetails, RapidSignError, } from "./errors.js";
export { DocumentsService } from "./documents.js";
export { VoiceService } from "./voice.js";
export { WebhooksService } from "./webhooks.js";
export { defaultTransport, } from "./internal/transport.js";
export { decodeGzipBase64, defaultDecompressor } from "./internal/decompress.js";
export { defaultSleeper, defaultUUIDGenerator, systemClock, } from "./internal/random.js";
export { MAX_DURATION_MS, parseDuration } from "./internal/duration.js";
//# sourceMappingURL=index.js.map