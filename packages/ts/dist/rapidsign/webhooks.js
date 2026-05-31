/**
 * Webhooks service stub.
 *
 * Per issue #38, the RapidSign service does not yet expose a webhook
 * surface. The SDK ships the typed verification entrypoint so consumers
 * write against the final shape today, and we flip the implementation when
 * the server lands.
 */
import { RapidSignError } from './errors.js';
const ISSUE_URL = 'https://github.com/Software-Automation-Holdings-LLC/isa-platform/issues/38';
/**
 * Webhook service exposed as `isa.rapidsign.webhooks`. Today every method
 * throws `RapidSignError.NotImplemented`; the SDK surface is final.
 */
export class WebhooksService {
    /**
     * Verify the HMAC signature on a webhook delivery and parse the body
     * into a typed `WebhookEvent`. Server-side support pending issue #38.
     */
    verify(_rawBody, _headers, _secret) {
        throw new RapidSignError.NotImplemented(`rapidsign.webhooks.verify is not yet implemented; webhook surface tracking: ${ISSUE_URL}`, { httpStatus: 501, requestId: '' });
    }
}
//# sourceMappingURL=webhooks.js.map