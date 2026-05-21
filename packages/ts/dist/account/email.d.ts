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
import { type AuthContext } from './auth';
import { type Transport } from '../zyins/transport';
import { type Clock } from '../core';
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
export declare function enqueue(request: EmailEnqueueRequest, ctx: EmailContext): Promise<EmailEnqueueResult>;
//# sourceMappingURL=email.d.ts.map