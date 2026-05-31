/**
 * `isa.account.email` — `POST /v1/email/enqueue`.
 *
 * Transactional email enqueue. `to` accepts either a single address or a
 * list (server treats `string[]` as a multi-recipient send). `attachment`
 * is optional and carries the filename and base64-encoded content
 * verbatim — encoding is the caller's responsibility so binary payloads
 * (PDFs) do not pay the cost of a UTF-8 round-trip through the SDK.
 *
 * The server response shape is `{ status: 'queued' | '1' }` per the legacy
 * BPP enqueue surface; both values are accepted and normalized to
 * `'queued'`.
 */

import { type AuthContext } from './auth.js';
import { type Transport } from '../zyins/transport.js';
import { fromHttpResponse } from '../zyins/errors.js';
import { deriveIdempotencyKey } from '../zyins/idempotency.js';
import { buildLicenseHMACHeaders } from '../core/index.js';
import { type Clock, systemClock } from '../core/index.js';

const EMAIL_PATH = '/v1/email/enqueue';

/** One attachment in an email-enqueue request. */
export interface EmailAttachment {
  filename: string;
  /** Base64-encoded content. Caller encodes; SDK passes through. */
  content: string;
}

/** Inputs for `account.email.enqueue`. */
export interface EmailEnqueueRequest {
  /** Recipient address(es). */
  to: string | string[];
  /** Email subject line. */
  subject: string;
  /** Body — server treats as HTML when content looks like HTML, else text. */
  body: string;
  /** Optional attachment (`content` is pre-base64-encoded by caller). */
  attachment?: EmailAttachment;
}

export interface EmailEnqueueResult {
  /** Normalized to `'queued'` regardless of which legacy literal the server returns. */
  status: 'queued';
}

export interface EmailContext {
  baseUrl: string;
  auth: AuthContext;
  transport: Transport;
  clock: Clock;
  idempotencyKey?: string;
}

/** Enqueue a transactional email. */
export async function enqueue(
  request: EmailEnqueueRequest,
  ctx: EmailContext,
): Promise<EmailEnqueueResult> {
  if (!request) {
    throw new Error('account: email.enqueue requires a request');
  }
  const recipients = normalizeRecipients(request.to);
  if (recipients.length === 0) {
    throw new Error('account: email.enqueue requires at least one recipient');
  }
  if (typeof request.subject !== 'string') {
    throw new Error('account: email.enqueue requires a subject');
  }
  if (typeof request.body !== 'string') {
    throw new Error('account: email.enqueue requires a body');
  }
  const wire: Record<string, unknown> = {
    to: Array.isArray(request.to) ? recipients : recipients[0],
    subject: request.subject,
    body_html: request.body,
  };
  if (request.attachment) {
    const attachment = request.attachment;
    wire['attachment'] = {
      filename: attachment.filename,
      content_base64: attachment.content,
    };
  }
  const wireBody = JSON.stringify(wire);
  const idempotencyKey =
    ctx.idempotencyKey ??
    (await deriveIdempotencyKey({
      deviceId: ctx.auth.deviceId,
      op: 'email_enqueue',
      body: wireBody,
    }));
  const headers = await buildLicenseHMACHeaders(
    ctx.auth.licenseKey,
    ctx.auth.orderId,
    ctx.auth.email,
    'POST',
    EMAIL_PATH,
    wireBody,
    ctx.auth.deviceId,
    ctx.clock ?? systemClock,
  );
  const response = await ctx.transport({
    url: `${ctx.baseUrl}${EMAIL_PATH}`,
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: wireBody,
  });
  if (response.status >= 200 && response.status < 300) {
    return { status: 'queued' };
  }
  throw fromHttpResponse(response.status, response.body);
}

function normalizeRecipients(to: string | string[]): string[] {
  if (Array.isArray(to)) {
    return to.filter((entry) => typeof entry === 'string' && entry.length > 0);
  }
  if (typeof to === 'string' && to.length > 0) return [to];
  return [];
}
