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
import { fromHttpResponse } from './errors';
import { buildLicenseHMACHeaders } from '../core';
import { base64EncodeUtf8, systemClock } from '../core';
const EMAIL_PATH = '/v1/email/enqueue';
/** Email a case to a recipient with a single attachment. */
export async function email(request, ctx) {
    const body = JSON.stringify({
        to: request.to,
        subject: request.subject,
        body_html: request.bodyHtml,
        attachment: {
            filename: request.attachmentFilename,
            content_base64: base64EncodeUtf8(request.attachmentContent),
        },
    });
    const headers = await buildLicenseHMACHeaders(ctx.auth.licenseKey, ctx.auth.orderId, ctx.auth.email, 'POST', EMAIL_PATH, body, ctx.auth.deviceId, ctx.clock ?? systemClock);
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
function parseEmailResponse(body) {
    try {
        const parsed = JSON.parse(body);
        const enqueueId = typeof parsed.enqueue_id === 'string' ? parsed.enqueue_id : '';
        return { enqueueId };
    }
    catch (err) {
        throw new Error(`ZyIns case.email: failed to parse response body: ${err.message}`);
    }
}
//# sourceMappingURL=case.js.map