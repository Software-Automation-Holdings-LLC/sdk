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
import { type Clock } from '../core/index.js';
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
export declare function email(request: CaseEmailRequest, ctx: CaseContext): Promise<CaseEmailResult>;
//# sourceMappingURL=case.d.ts.map