/**
 * Tier 3 case operations.
 *
 * Emails a case PDF (or other attachment) to a recipient. The legacy bpp2.0
 * call site base64-encodes the attachment, builds the JSON body, and POSTs
 * to the email endpoint inline. Tier 3 collapses that into one typed call.
 *
 * The attachment is base64-encoded internally via `base64EncodeUtf8`, so
 * call sites pass the raw string content; international characters in the
 * attachment do not throw `InvalidCharacterError` (a real bug in older
 * browser `btoa` paths).
 */

import { type AuthContext } from './auth.js';
import { type Transport } from './transport.js';
import { fromHttpResponse } from './errors.js';
import { buildLicenseHMACHeaders } from '../core/index.js';
import { base64EncodeUtf8, type Clock, systemClock } from '../core/index.js';

const EMAIL_PATH = '/v1/email/enqueue';

/** Inputs for `case.email`. */
export interface CaseEmailRequest {
  /** Recipient email address. */
  to: string;
  /** Email subject line. */
  subject: string;
  /** Email body as HTML. */
  bodyHtml: string;
  /** Suggested filename for the attachment (e.g., "case-12345.pdf"). */
  attachmentFilename: string;
  /** Raw attachment content; the SDK base64-encodes it. */
  attachmentContent: string;
}

export interface CaseEmailResult {
  /** Server-issued enqueue ID; useful for correlating with delivery logs. */
  enqueueId: string;
}

/** Shared context for case operations. */
export interface CaseContext {
  baseUrl: string;
  auth: AuthContext;
  transport: Transport;
  clock: Clock;
}

/** Email a case to a recipient with a single attachment. */
export async function email(
  request: CaseEmailRequest,
  ctx: CaseContext,
): Promise<CaseEmailResult> {
  const body = JSON.stringify({
    to: request.to,
    subject: request.subject,
    body_html: request.bodyHtml,
    attachment: {
      filename: request.attachmentFilename,
      content_base64: base64EncodeUtf8(request.attachmentContent),
    },
  });
  const headers = await buildLicenseHMACHeaders(
    ctx.auth.licenseKey,
    ctx.auth.orderId,
    ctx.auth.email,
    'POST',
    EMAIL_PATH,
    body,
    ctx.auth.deviceId,
    ctx.clock ?? systemClock,
  );
  const response = await ctx.transport({
    url: `${ctx.baseUrl}${EMAIL_PATH}`,
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body,
  });
  if (response.status >= 200 && response.status < 300) {
    return parseEmailResponse(response.body);
  }
  throw fromHttpResponse(response.status, response.body);
}

function parseEmailResponse(body: string): CaseEmailResult {
  try {
    const parsed = JSON.parse(body) as { enqueue_id?: unknown };
    const enqueueId = typeof parsed.enqueue_id === 'string' ? parsed.enqueue_id : '';
    return { enqueueId };
  } catch (err) {
    throw new Error(`ZyIns case.email: failed to parse response body: ${(err as Error).message}`);
  }
}
