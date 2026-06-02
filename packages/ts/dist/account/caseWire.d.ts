/**
 * Wire helpers for the zero-knowledge case store: share-link assembly +
 * parsing, and response decoding for `/v1/case`. Kept separate from the
 * operation logic in `cases.ts` so each file stays focused (link/​parse vs.
 * transport orchestration).
 *
 * The link is the capability: it carries the case id in the path and the
 * decryption key in the `#k=` fragment. These helpers never log it.
 */
import { type TCaseEnvelope } from './caseCrypto.js';
/** A case's id and fragment key, parsed out of a share link. */
export interface TParsedLink {
    id: string;
    keyFragment: string;
}
/** A case's metadata as returned by the list endpoint (never ciphertext). */
export interface TCaseListEntry {
    id: string;
    product: string;
    createdAt: string;
    expiresAt: string;
}
/**
 * Assemble `${base}/<code>#k=<keyFragment>`, normalizing a trailing slash on
 * the viewer base. The code is the only path segment the SDK adds; any product
 * prefix rides inside the configured base URL — this never adds one.
 */
export declare function assembleLink(viewerBaseUrl: string, code: string, keyFragment: string): string;
/**
 * Parse a share link into its case id and fragment key. Accepts both the
 * current single-segment shape (`{base}/<code>#k=<key>`) and the legacy
 * `{base}/c/<id>#k=<key>` shape, so links shared before the format change keep
 * opening. The id/code is the last non-empty path segment.
 */
export declare function parseLink(link: string): TParsedLink;
/** Decode a create response into the server-assigned case id. */
export declare function parseCreatedId(body: string): string;
/** Decode a `GET /v1/case/{uuid}` response into its product + opaque envelope. */
export declare function parseCaseDetail(body: string): {
    product: string;
    envelope: TCaseEnvelope;
};
/** Decode a list response into metadata rows (ciphertext is never present). */
export declare function parseCaseList(body: string): TCaseListEntry[];
//# sourceMappingURL=caseWire.d.ts.map