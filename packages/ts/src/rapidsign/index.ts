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

export {
  RapidSignClient,
  DEFAULT_RAPIDSIGN_BASE_URL,
  DEFAULT_USER_AGENT,
  DEFAULT_MAX_RETRIES,
  type RapidSignClientOptions,
} from './client';

export {
  RapidSignError,
  fromHttpResponse,
  fromProblemDetails,
  type ErrorCode,
  type RapidSignErrorInit,
} from './errors';

export {
  type Envelope,
  type EnvelopeStatus,
  type Recipient,
  type PdfSource,
  type SendRequest,
  type CancelRequest,
  type AwaitOpts,
  type Signature,
} from './types';

export { DocumentsService, type DocumentsContext } from './documents';
export { WebhooksService, type WebhookEvent } from './webhooks';

export {
  defaultTransport,
  type Transport,
  type TransportRequest,
  type TransportResponse,
  type HttpMethod,
} from './internal/transport';

export {
  defaultDecompressor,
  decodeGzipBase64,
  type Decompressor,
} from './internal/decompress';

export {
  defaultUUIDGenerator,
  defaultSleeper,
  systemClock,
  type Clock,
  type Sleeper,
  type UUIDGenerator,
} from './internal/random';

export { parseDuration, MAX_DURATION_MS } from './internal/duration';
