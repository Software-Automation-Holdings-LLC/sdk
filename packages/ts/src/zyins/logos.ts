/**
 * Tier 3 logos operations — `GET /v1/logos/{carrier}`.
 *
 * Static carrier-brand assets. Per `api-standards.md` (GET allowlist), the
 * endpoint is non-credentialed: the SDK does NOT attach auth headers. Two
 * response shapes are negotiated via the `?ds=` query parameter:
 *
 *   - `?ds=true`  → server returns a `data:image/...;base64,...` text body.
 *   - default     → server returns the raw image bytes (typically PNG/JPEG).
 *
 * The SDK presents a single call surface (`get(carrier, { dataUri? })`) and
 * branches internally on `dataUri` to return the right shape:
 *
 *   - `dataUri: true`   → resolves to `string` (the data URI).
 *   - `dataUri` omitted → resolves to `Blob` (the raw bytes).
 *
 * Callers never juggle two shapes. The branch is encoded in the call site
 * via an overload so TypeScript narrows the return type at the call.
 *
 * 404 — when the carrier has no logo asset — surfaces as a typed
 * `ZyInsError` with code `not_found`, matching the rest of the Tier 3 funnel.
 */

import { resolveFetch } from '../core';
import { fromHttpResponse, ZyInsError } from './errors';

/** Path prefix for the carrier-logo endpoint (canonical per api-standards.md). */
const LOGOS_PATH = '/v1/logos';

/** Options accepted by {@link get}. */
export interface LogosGetOptions {
  /**
   * When `true`, returns the asset as a `data:` URI string. When omitted or
   * `false`, returns the raw bytes as a `Blob`. The SDK branches on this
   * field so the caller never has to handle both shapes at one call site.
   */
  dataUri?: boolean;
}

/**
 * Pluggable fetcher used by {@link get}. Tests inject a stub so the call
 * never touches `globalThis.fetch`. Production wires `resolveFetch()` so
 * the default behaves identically to the rest of the SDK.
 */
export type LogosFetch = (url: string) => Promise<LogosResponse>;

/** Minimal response shape the logos module needs from a fetcher. */
export interface LogosResponse {
  status: number;
  /** Read the body as a text string. Used for data-URI responses. */
  text(): Promise<string>;
  /** Read the body as a Blob. Used for raw-bytes responses. */
  blob(): Promise<Blob>;
}

/** Per-call context for the logos sub-client. */
export interface LogosContext {
  baseUrl: string;
  /** Optional fetcher override; defaults to `globalThis.fetch`. */
  fetchImpl?: LogosFetch;
}

/**
 * Fetch the carrier-logo asset.
 *
 * Overloads encode the dataUri branch into the return type so the caller
 * never gets `Blob | string` and never has to widen-then-narrow.
 */
export function get(
  carrier: string,
  opts: LogosGetOptions & { dataUri: true },
  ctx: LogosContext,
): Promise<string>;
export function get(
  carrier: string,
  opts: (LogosGetOptions & { dataUri?: false | undefined }) | undefined,
  ctx: LogosContext,
): Promise<Blob>;
export function get(
  carrier: string,
  opts: LogosGetOptions | undefined,
  ctx: LogosContext,
): Promise<Blob | string>;
export async function get(
  carrier: string,
  opts: LogosGetOptions | undefined,
  ctx: LogosContext,
): Promise<Blob | string> {
  const url = buildLogosUrl(ctx.baseUrl, carrier, opts?.dataUri === true);
  const response = await callLogos(url, ctx.fetchImpl);
  if (response.status < 200 || response.status >= 300) {
    const body = await safeReadText(response);
    throw fromHttpResponse(response.status, body);
  }
  if (opts?.dataUri === true) {
    const text = await response.text();
    return assertDataUri(text);
  }
  return response.blob();
}

/**
 * Sub-client wrapping {@link get} for use from {@link ZyInsClient}. Kept in
 * this file so `client.ts` stays under the 250-line cap.
 */
export class LogosSubClient {
  constructor(
    private readonly baseUrl: string,
    private readonly fetchImpl: LogosFetch | undefined,
  ) {}

  /** Fetch the carrier-logo asset with return type narrowed by `dataUri`. */
  get(carrier: string, opts: LogosGetOptions & { dataUri: true }): Promise<string>;
  get(carrier: string, opts?: LogosGetOptions & { dataUri?: false | undefined }): Promise<Blob>;
  get(carrier: string, opts?: LogosGetOptions): Promise<Blob | string>;
  get(carrier: string, opts?: LogosGetOptions): Promise<Blob | string> {
    const ctx: LogosContext = { baseUrl: this.baseUrl };
    if (this.fetchImpl !== undefined) ctx.fetchImpl = this.fetchImpl;
    return get(carrier, opts, ctx);
  }
}

/** Build the request URL, URI-encoding the carrier path segment. */
function buildLogosUrl(baseUrl: string, carrier: string, dataUri: boolean): string {
  const normalizedCarrier = carrier.trim();
  if (!normalizedCarrier) {
    throw new ZyInsError('zyins.logos.get: carrier is required', {
      code: 'validation_error',
    });
  }
  const path = `${LOGOS_PATH}/${encodeURIComponent(normalizedCarrier)}`;
  const suffix = dataUri ? '?ds=true' : '';
  return `${baseUrl}${path}${suffix}`;
}

/**
 * Adapter that lifts a standard `fetch` into the {@link LogosFetch} shape.
 * Kept here (rather than alongside the default transport) because logos is
 * the only Tier 3 operation that needs Blob + text on the same response —
 * the standard `Transport` collapses every body to a string.
 */
function callLogos(url: string, fetchImpl?: LogosFetch): Promise<LogosResponse> {
  if (fetchImpl) return fetchImpl(url);
  const f = resolveFetch(undefined, 'ZyInsLogosTransport');
  return f(url).then((r) => ({
    status: r.status,
    text: () => r.text(),
    blob: () => r.blob(),
  }));
}

/**
 * Read a response body as text without throwing. Used to enrich the error
 * thrown on non-2xx — if the server emitted a ProblemDetails JSON it carries
 * through into the typed error funnel.
 */
async function safeReadText(response: LogosResponse): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

/**
 * Guard the data-URI response — if the server (or a misconfigured proxy)
 * returned non-text on the `?ds=true` path the caller should hear about it
 * loudly rather than silently get back a body that looks like a URI but
 * isn't. The check matches `data:` followed by an image media-type prefix,
 * per RFC 2397.
 */
function assertDataUri(body: string): string {
  if (!body.startsWith('data:image/')) {
    throw new ZyInsError(
      `zyins.logos.get: expected a data:image/... URI but got: ${body.slice(0, 32)}`,
      { code: 'unknown' },
    );
  }
  return body;
}
