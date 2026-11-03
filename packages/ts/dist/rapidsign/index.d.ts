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
export { DEFAULT_MAX_RETRIES, DEFAULT_RAPIDSIGN_BASE_URL, DEFAULT_USER_AGENT, RapidSignClient, type RapidSignClientOptions, } from "./client.js";
export { type ErrorCode, fromHttpResponse, fromProblemDetails, RapidSignError, type RapidSignErrorInit, } from "./errors.js";
export { type AwaitOpts, type CancelRequest, type DownloadOpts, type Envelope, type EnvelopeStatus, type GetOpts, type MintCodeRequest, type PdfSource, type Recipient, type SendRequest, type Signature, type VoiceCode, type VoiceScript, type VoiceStep, type VoiceStepKind, } from "./types.js";
export { type DocumentsContext, DocumentsService } from "./documents.js";
export { VoiceService } from "./voice.js";
export { type WebhookEvent, WebhooksService } from "./webhooks.js";
export { defaultTransport, type HttpMethod, type Transport, type TransportRequest, type TransportResponse, } from "./internal/transport.js";
export { decodeGzipBase64, type Decompressor, defaultDecompressor } from "./internal/decompress.js";
export { type Clock, defaultSleeper, defaultUUIDGenerator, type Sleeper, systemClock, type UUIDGenerator, } from "./internal/random.js";
export { MAX_DURATION_MS, parseDuration } from "./internal/duration.js";
//# sourceMappingURL=index.d.ts.map