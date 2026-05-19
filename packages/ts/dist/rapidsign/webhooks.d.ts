/**
 * Webhooks service stub.
 *
 * Per issue #38, the RapidSign service does not yet expose a webhook
 * surface. The SDK ships the typed verification entrypoint so consumers
 * write against the final shape today, and we flip the implementation when
 * the server lands.
 */
/** Decoded webhook event. The concrete payload shape lands with the server. */
export interface WebhookEvent {
    readonly id: string;
    readonly type: string;
    readonly createdAt: Date;
    readonly data: unknown;
}
/**
 * Webhook service exposed as `isa.rapidsign.webhooks`. Today every method
 * throws `RapidSignError.NotImplemented`; the SDK surface is final.
 */
export declare class WebhooksService {
    /**
     * Verify the HMAC signature on a webhook delivery and parse the body
     * into a typed `WebhookEvent`. Server-side support pending issue #38.
     */
    verify(_rawBody: string | Buffer, _headers: Record<string, string>, _secret: string): WebhookEvent;
}
//# sourceMappingURL=webhooks.d.ts.map