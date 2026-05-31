/**
 * RapidSign documents service.
 *
 * Five public methods on the SDK surface:
 *
 *   - `send`             — create + notify (one logical op; two server calls today)
 *   - `get`              — read current state
 *   - `awaitSignature`   — poll until signed or timeout
 *   - `download`         — fetch the signed PDF (transparently decompressed)
 *   - `cancel`           — cancel a pending envelope (server endpoint pending, #38)
 *
 * Two of these methods are "shape leads server": `send` collapses a
 * `CreateDocument` + `NotifyDocument` pair the proto exposes separately, and
 * `cancel` throws `NotImplemented` until the matching server endpoint ships
 * (tracked in issue #38). The SDK surface is the product.
 */

import {
  type AwaitOpts,
  type CancelRequest,
  type Envelope,
  type EnvelopeStatus,
  type PdfSource,
  type Recipient,
  type SendRequest,
  type Signature,
} from './types.js';
import {
  RapidSignError,
  fromHttpResponse,
} from './errors.js';
import { type Transport } from './internal/transport.js';
import { decodeGzipBase64, type Decompressor } from './internal/decompress.js';
import {
  type Clock,
  type Sleeper,
  type UUIDGenerator,
} from './internal/random.js';
import { isIso8601Duration, parseDuration, MAX_DURATION_MS } from './internal/duration.js';

/** Per-call context the parent client injects. */
export interface DocumentsContext {
  readonly token: string;
  readonly baseUrl: string;
  readonly userAgent: string;
  readonly transport: Transport;
  readonly clock: Clock;
  readonly sleeper: Sleeper;
  readonly uuid: UUIDGenerator;
  readonly decompressor: Decompressor;
  readonly maxRetries: number;
}

/** Path prefixes (a single source of truth for routing). */
const PATH = {
  documents: '/v1/documents',
  document: (signId: string): string => `/v1/documents/${encodeURIComponent(signId)}`,
  notify: (signId: string): string => `/v1/documents/${encodeURIComponent(signId)}/notify`,
  download: (signId: string): string => `/v1/documents/${encodeURIComponent(signId)}/download`,
  cancel: (signId: string): string => `/v1/documents/${encodeURIComponent(signId)}/cancel`,
} as const;

/** Default poll interval and cap for awaitSignature. */
const POLL_BASE_MS = 2_000;
const POLL_MAX_MS = 30_000;
const POLL_JITTER = 0.25; // ±25%
const DEFAULT_AWAIT_TIMEOUT_MS = 24 * 60 * 60 * 1_000;

/** Issue #38 tracks the missing server-side endpoints. */
const ISSUE_URL = 'https://github.com/Software-Automation-Holdings-LLC/isa-platform/issues/38';

/** Public service object exposed as `isa.rapidsign.documents`. */
export class DocumentsService {
  constructor(private readonly ctx: DocumentsContext) {}

  /**
   * Send a packet to a recipient. Issues a `CreateDocument` then
   * `NotifyDocument`; both fail-safely (a failed notify after a successful
   * create surfaces as the underlying error, leaving the packet retrievable
   * by sign id for a retry).
   */
  async send(request: SendRequest): Promise<Envelope> {
    validateSendRequest(request);
    const sessionId = this.ctx.uuid();
    const signId = this.ctx.uuid();
    const idempotencyKey = request.idempotencyKey ?? this.ctx.uuid();
    const createBody = buildCreateBody(request, sessionId, signId);
    const created = await this.callJSON<CreateResponseBody>({
      method: 'POST',
      path: PATH.documents,
      body: createBody,
      idempotencyKey,
    });
    const resolvedSignId = extractSignId(created, signId);
    await this.callJSON<NotifyResponseBody>({
      method: 'POST',
      path: PATH.notify(resolvedSignId),
      body: {
        sign_id: resolvedSignId,
        session_id: sessionId,
        to: request.recipient.email,
        ...(request.notificationKey !== undefined && { key: request.notificationKey }),
      },
      idempotencyKey: this.ctx.uuid(),
    });
    return assembleEnvelope({
      request,
      sessionId,
      signId: resolvedSignId,
      created,
      now: this.ctx.clock(),
    });
  }

  /**
   * Fetch current state for a signed-or-pending envelope. Returns a
   * Signature when the document has been signed; throws `NotFound` when
   * the sign id is unknown or no signature has been captured yet.
   */
  async get(signId: string, sessionId?: string, signal?: AbortSignal): Promise<Signature> {
    requireSignId(signId);
    const url = `${this.ctx.baseUrl}${PATH.document(signId)}${querystring({ session_id: sessionId })}`;
    let attempt = 0;
    while (true) {
      const response = await this.ctx.transport({
        url,
        method: 'GET',
        headers: this.headers(),
        body: '',
        signal,
      });
      if (response.status === 200) {
        return parseSignatureBody(response.body, this.ctx.clock());
      }
      const err = fromHttpResponse(response.status, response.body, response.headers);
      if (!err.retryable || attempt >= this.ctx.maxRetries) {
        throw err;
      }
      const delay = err.retryAfterMs ?? backoffMs(attempt, this.ctx.uuid);
      await this.ctx.sleeper(delay, signal);
      attempt += 1;
    }
  }

  /**
   * Poll `get` on a jittered exponential backoff until the document is
   * signed, the AbortSignal fires, or the timeout elapses.
   *
   * On the first `get` 404, probes `download` once: per proto, download
   * 404 means no document was stored for the sign id (invalid id), while
   * get 404 alone means the signature is not captured yet.
   */
  async awaitSignature(signId: string, opts: AwaitOpts = {}): Promise<Signature> {
    requireSignId(signId);
    const timeoutMs = clampTimeout(opts.timeout);
    const start = this.ctx.clock();
    let attempt = 0;
    let probedDocumentStore = false;
    while (true) {
      opts.signal?.throwIfAborted?.();
      try {
        return await this.get(signId, undefined, opts.signal);
      } catch (err) {
        if (!(err instanceof RapidSignError.NotFound)) throw err;
        if (!probedDocumentStore) {
          try {
            const stored = await this.signIdHasStoredDocument(signId, opts.signal);
            probedDocumentStore = true;
            if (!stored) {
              throw new RapidSignError.NotFound(
                `awaitSignature: no document stored for sign id ${signId}`,
                { httpStatus: 404, requestId: err.requestId },
              );
            }
          } catch (probeErr) {
            if (probeErr instanceof RapidSignError && probeErr.retryable) {
              // Transient probe failure — retry probe on the next NotFound.
            } else {
              throw probeErr;
            }
          }
        }
      }
      const elapsed = this.ctx.clock() - start;
      const remaining = timeoutMs - elapsed;
      if (remaining <= 0) {
        throw new RapidSignError.DeadlineExceeded(
          `awaitSignature: timed out after ${timeoutMs}ms waiting for ${signId}`,
          { httpStatus: 408, requestId: '' },
        );
      }
      const delay = Math.min(remaining, nextPollDelayMs(attempt, this.ctx.uuid));
      await this.ctx.sleeper(delay, opts.signal);
      attempt += 1;
    }
  }

  /**
   * Download the signed PDF as a fresh `Buffer`. The wire response is
   * gzip + base64; decompression is transparent. Throws `NotFound` if the
   * sign id is unknown.
   */
  async download(signId: string, sessionId?: string): Promise<Buffer> {
    requireSignId(signId);
    const url = `${this.ctx.baseUrl}${PATH.download(signId)}${querystring({ session_id: sessionId })}`;
    let attempt = 0;
    while (true) {
      const response = await this.ctx.transport({
        url,
        method: 'GET',
        headers: this.headers(),
        body: '',
      });
      if (response.status === 200) {
        const parsed = safeParseJson<DownloadResponseBody>(response.body);
        if (!parsed || typeof parsed.pdf_gzip_base64 !== 'string') {
          throw new RapidSignError.Unknown(
            'download: server returned a 200 with an unparseable body',
            { httpStatus: 200, requestId: response.headers['x-request-id'] ?? '' },
          );
        }
        if (parsed.compressed === false) {
          return Buffer.from(parsed.pdf_gzip_base64, 'base64');
        }
        return decodeGzipBase64(parsed.pdf_gzip_base64, this.ctx.decompressor);
      }
      const err = fromHttpResponse(response.status, response.body, response.headers);
      if (!err.retryable || attempt >= this.ctx.maxRetries) {
        throw err;
      }
      const delay = err.retryAfterMs ?? backoffMs(attempt, this.ctx.uuid);
      await this.ctx.sleeper(delay);
      attempt += 1;
    }
  }

  /**
   * Cancel a pending envelope.
   *
   * The matching server endpoint is not yet implemented (tracked at the
   * issue URL embedded in the thrown error). The SDK surface lands here so
   * the cross-language contract is final; flipping the error to a real call
   * is a one-line change once the server lands.
   */
  async cancel(signId: string, request: CancelRequest): Promise<void> {
    requireSignId(signId);
    if (!request || typeof request.reason !== 'string' || request.reason.length === 0) {
      throw new RapidSignError.ValidationError('cancel: request.reason is required', {
        httpStatus: 400,
        requestId: '',
        param: 'reason',
      });
    }
    throw new RapidSignError.NotImplemented(
      `documents.cancel is not yet implemented on the server (tracking: ${ISSUE_URL})`,
      { httpStatus: 501, requestId: '' },
    );
  }

  /** Authorization + UA + JSON content-type. Per-call extras are merged in. */
  private headers(extras: Record<string, string> = {}): Record<string, string> {
    return {
      Authorization: `Bearer ${this.ctx.token}`,
      'User-Agent': this.ctx.userAgent,
      Accept: 'application/json, application/problem+json',
      ...extras,
    };
  }

  /**
   * JSON-body request helper. Handles retries on 5xx/429 (bounded by
   * `maxRetries`) and surfaces the typed error funnel.
   */
  private async callJSON<TResponse>(args: {
    method: 'POST' | 'GET' | 'DELETE';
    path: string;
    body: unknown;
    idempotencyKey?: string;
  }): Promise<TResponse> {
    const serialized = args.body === undefined ? '' : JSON.stringify(args.body);
    const headers = this.headers({
      'Content-Type': 'application/json',
      ...(args.idempotencyKey !== undefined && { 'Idempotency-Key': args.idempotencyKey }),
    });
    let attempt = 0;
    while (true) {
      const response = await this.ctx.transport({
        url: `${this.ctx.baseUrl}${args.path}`,
        method: args.method,
        headers,
        body: serialized,
      });
      if (response.status >= 200 && response.status < 300) {
        return safeParseJson<TResponse>(response.body) ?? ({} as TResponse);
      }
      const err = fromHttpResponse(response.status, response.body, response.headers);
      if (!err.retryable || attempt >= this.ctx.maxRetries) {
        throw err;
      }
      const delay = err.retryAfterMs ?? backoffMs(attempt, this.ctx.uuid);
      await this.ctx.sleeper(delay);
      attempt += 1;
    }
  }

  /**
   * Whether the server has a stored document packet for `signId`.
   * Download returns 404 when no document exists (per proto).
   */
  private async signIdHasStoredDocument(
    signId: string,
    signal?: AbortSignal,
  ): Promise<boolean> {
    const url = `${this.ctx.baseUrl}${PATH.download(signId)}`;
    const response = await this.ctx.transport({
      url,
      method: 'GET',
      headers: this.headers(),
      body: '',
      signal,
    });
    if (response.status === 404) {
      return false;
    }
    if (response.status >= 200 && response.status < 300) {
      return true;
    }
    throw fromHttpResponse(response.status, response.body, response.headers);
  }

}

/* ---------- wire body shapes (snake_case, server-owned) ---------- */

interface CreateResponseBody {
  packet_stored?: boolean;
  hashes?: Record<string, string>;
  sign_ids?: string[];
  sign_id?: string;
  view_only_id?: string;
  document_id?: string;
  sign_url?: string;
  view_url?: string;
  created_at?: string;
  expires_at?: string;
}

interface NotifyResponseBody {
  sign_id?: string;
  status?: string;
}

interface SignatureResponseBody {
  sign_id?: string;
  signature?: string;
  user_metadata?: string | Record<string, string>;
  timestamp?: number;
  signer_ip?: string;
  user_agent?: string;
}

interface DownloadResponseBody {
  pdf_gzip_base64?: string;
  compressed?: boolean;
  size_bytes?: number;
  binding_legal_text?: string;
}

/* ---------- helpers ---------- */

function validateSendRequest(request: SendRequest): void {
  if (!request) {
    throw new RapidSignError.ValidationError('send: request is required', {
      httpStatus: 400,
      requestId: '',
    });
  }
  if (!Array.isArray(request.packet) || request.packet.length === 0) {
    throw new RapidSignError.ValidationError('send: packet must be a non-empty array', {
      httpStatus: 400,
      requestId: '',
      param: 'packet',
    });
  }
  for (const [i, source] of request.packet.entries()) {
    if (!source.url || typeof source.url !== 'string') {
      throw new RapidSignError.ValidationError(
        `send: packet[${i}].url is required`,
        { httpStatus: 400, requestId: '', param: `packet[${i}].url` },
      );
    }
  }
  if (
    !request.recipient ||
    typeof request.recipient.email !== 'string' ||
    request.recipient.email.length === 0
  ) {
    throw new RapidSignError.ValidationError('send: recipient.email is required', {
      httpStatus: 400,
      requestId: '',
      param: 'recipient.email',
    });
  }
}

function buildCreateBody(request: SendRequest, sessionId: string, signId: string): unknown {
  const packet = request.packet.map((p: PdfSource) => ({
    url: p.url,
    ...(p.expectedHash !== undefined && { expected_hash: p.expectedHash }),
  }));
  const body: Record<string, unknown> = {
    session_id: sessionId,
    packet,
    sign_ids: [signId],
    remote_allowed: true,
    is_production: true,
  };
  if (request.legalText !== undefined) {
    body.binding_legal_text = request.legalText;
  }
  if (request.metadata !== undefined) {
    body.metadata = request.metadata;
  }
  if (request.expiresIn !== undefined) {
    body.ttl = normalizeTtl(request.expiresIn);
  }
  return body;
}

function normalizeTtl(value: string | number): string {
  if (typeof value === 'string' && isIso8601Duration(value)) {
    return value.trim().toUpperCase();
  }
  const ms = parseDuration(value);
  const seconds = Math.floor(ms / 1_000);
  return `PT${seconds}S`;
}

function extractSignId(created: CreateResponseBody, clientSignId: string): string {
  if (Array.isArray(created.sign_ids) && created.sign_ids.length > 0) {
    return created.sign_ids[0] as string;
  }
  if (typeof created.sign_id === 'string' && created.sign_id.length > 0) {
    return created.sign_id;
  }
  return clientSignId;
}

function assembleEnvelope(args: {
  request: SendRequest;
  sessionId: string;
  signId: string;
  created: CreateResponseBody;
  now: number;
}): Envelope {
  const { request, signId, created, now } = args;
  const id = created.document_id;
  if (!id) {
    throw new RapidSignError.Unknown(
      'send: server response did not include document_id',
      { httpStatus: 200, requestId: '' },
    );
  }
  const recipient: Recipient = {
    email: request.recipient.email,
    ...(request.recipient.name !== undefined && { name: request.recipient.name }),
  };
  const status: EnvelopeStatus = 'notified';
  const createdAt = parseTimestamp(created.created_at) ?? new Date(now);
  const expiresAt =
    parseTimestamp(created.expires_at) ??
    new Date(now + (request.expiresIn !== undefined ? parseDuration(request.expiresIn) : 30 * 24 * 60 * 60 * 1_000));
  return {
    id,
    signId,
    signUrl: created.sign_url ?? '',
    viewUrl: created.view_url ?? '',
    status,
    recipient,
    hashes: created.hashes ?? {},
    createdAt,
    expiresAt,
    metadata: request.metadata ?? {},
  };
}

function parseTimestamp(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms) : undefined;
}

function parseSignatureBody(body: string, now: number): Signature {
  const parsed = safeParseJson<SignatureResponseBody>(body);
  if (!parsed || typeof parsed.signature !== 'string') {
    throw new RapidSignError.Unknown(
      'get: server returned a 200 with an unparseable body',
      { httpStatus: 200, requestId: '' },
    );
  }
  const signedAtMs = typeof parsed.timestamp === 'number' ? parsed.timestamp * 1_000 : now;
  const metadata = coerceMetadata(parsed.user_metadata);
  return {
    signId: parsed.sign_id ?? '',
    signature: Buffer.from(parsed.signature, 'base64'),
    signedAt: new Date(signedAtMs),
    signerIp: parsed.signer_ip ?? metadata.ip ?? '',
    userAgent: parsed.user_agent ?? metadata.user_agent ?? '',
    metadata,
  };
}

function coerceMetadata(raw: unknown): Record<string, string> {
  if (raw === undefined || raw === null) return {};
  if (typeof raw === 'string') {
    const parsed = safeParseJson<Record<string, unknown>>(raw);
    if (parsed && typeof parsed === 'object') {
      return stringifyEntries(parsed);
    }
    return {};
  }
  if (typeof raw === 'object') {
    return stringifyEntries(raw as Record<string, unknown>);
  }
  return {};
}

function stringifyEntries(obj: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string') out[k] = v;
    else if (typeof v === 'number' || typeof v === 'boolean') out[k] = String(v);
  }
  return out;
}

function querystring(params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  if (entries.length === 0) return '';
  const qs = entries
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v as string)}`)
    .join('&');
  return `?${qs}`;
}

function safeParseJson<T>(body: string): T | undefined {
  if (!body) return undefined;
  try {
    return JSON.parse(body) as T;
  } catch {
    return undefined;
  }
}

function requireSignId(signId: string): void {
  if (typeof signId !== 'string' || signId.length === 0) {
    throw new RapidSignError.ValidationError('signId is required', {
      httpStatus: 400,
      requestId: '',
      param: 'signId',
    });
  }
}

function clampTimeout(timeout: string | number | undefined): number {
  if (timeout === undefined) return DEFAULT_AWAIT_TIMEOUT_MS;
  const ms = parseDuration(timeout);
  if (ms > MAX_DURATION_MS) {
    throw new RapidSignError.ValidationError(
      `awaitSignature: timeout ${ms}ms exceeds maximum of ${MAX_DURATION_MS}ms`,
      { httpStatus: 400, requestId: '', param: 'timeout' },
    );
  }
  return ms;
}

/**
 * Compute the next poll delay. Exponential base 2s capped at 30s with
 * ±25% jitter. Jitter uses the UUID generator's randomness without leaking
 * a `Math.random()` call out of the facade.
 */
function nextPollDelayMs(attempt: number, uuid: UUIDGenerator): number {
  const target = Math.min(POLL_BASE_MS * 2 ** attempt, POLL_MAX_MS);
  return applyJitter(target, uuid);
}

/** First-retry backoff (also jittered). */
function backoffMs(attempt: number, uuid: UUIDGenerator): number {
  const target = Math.min(500 * 2 ** attempt, 8_000);
  return applyJitter(target, uuid);
}

function applyJitter(targetMs: number, uuid: UUIDGenerator): number {
  // Pull 6 bits of entropy from the UUID's first hex chars to derive a
  // jitter factor in [-POLL_JITTER, +POLL_JITTER].
  const id = uuid();
  const hex = id.replace(/-/g, '').slice(0, 2);
  const v = Number.parseInt(hex, 16) / 255; // [0, 1]
  const offset = (v * 2 - 1) * POLL_JITTER;
  return Math.floor(targetMs * (1 + offset));
}
