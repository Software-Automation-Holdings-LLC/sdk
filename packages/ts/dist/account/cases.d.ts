/**
 * `isa.account.cases` — zero-knowledge case share + recall over `/v1/case`.
 *
 *   create → `POST /v1/case`          (opaque ciphertext in, id out)
 *   open   → `GET  /v1/case/{uuid}`   (opaque ciphertext out, decrypt local)
 *   list   → `POST /v1/case/list`     (metadata only, no ciphertext)
 *   email  → `POST /v1/case/{id}/email`
 *
 * The payload is applicant PII the platform must never decrypt. The SDK
 * encrypts client-side with a fresh per-case key (AES-256-GCM, `product`
 * bound as AEAD data), posts only the opaque envelope, and carries the key
 * in the share-link fragment (`#k=…`) — never on the wire, never in a log.
 * See `docs/design/case-store-e2ee.md` and zyins #363 for the wire contract.
 *
 * HARD RULE — no key/fragment leakage: the assembled link is returned to the
 * caller as a value and nothing else. It is never logged, never embedded in a
 * telemetry payload, and never attached to a thrown error. The encrypt step
 * keeps the key local to {@link create}; `open` parses it from the link the
 * caller already holds. Downstream consumers (bpp2.0, Phase 3) must scrub
 * `location.hash` before any telemetry call.
 */
import { type TCaseListEntry } from './caseWire.js';
import { type TCaseRequestContext } from './caseTransport.js';
/**
 * Default share-link viewer origin. The SDK appends `/c/<id>#k=<key>`; the
 * base intentionally omits the `/c/` segment so a deployment can point the
 * option at any host without re-encoding the path shape.
 */
export declare const DEFAULT_CASE_VIEWER_BASE_URL = "https://app.isaapi.com";
/**
 * Cleartext routing tag identifying the app that owns the payload. Not PII;
 * mirrors the known zyins #363 product set while preserving server-side
 * forward compatibility for future product values.
 */
export type TCaseProduct = 'zyins' | 'eapp' | 'rapidsign' | (string & {});
/** Inputs for `account.cases.create`. */
export interface CaseCreateRequest {
    /** Routing tag stored cleartext and bound as AEAD data during encryption. */
    product: TCaseProduct;
    /** Arbitrary JSON payload; encrypted client-side before it leaves the SDK. */
    payload: unknown;
}
/** Result of `account.cases.create`: the case id and the assembled share link. */
export interface CaseCreateResult {
    /** Server-assigned case uuid. */
    id: string;
    /** Full share link `${caseViewerBaseUrl}/c/<id>#k=<base64url(key)>`. */
    link: string;
}
/** A decrypted case returned by `open`. */
export interface CaseOpenResult {
    /** Routing tag the case was created under. */
    product: string;
    /** The decrypted payload. */
    payload: unknown;
}
/** Case metadata returned by `list` — never carries ciphertext. */
export type CaseSummary = TCaseListEntry;
/** Inputs for `account.cases.email`. */
export interface CaseEmailRequest {
    caseId: string;
    to: string;
}
export interface CaseEmailResult {
    queued: true;
}
/** Per-operation context: signed-request inputs plus the viewer origin. */
export interface CasesContext extends TCaseRequestContext {
    /** Viewer origin for share-link assembly; see {@link DEFAULT_CASE_VIEWER_BASE_URL}. */
    caseViewerBaseUrl: string;
}
/**
 * Encrypt a payload client-side, store the opaque envelope, and return the
 * fragment-keyed share link. The decryption key never reaches the server.
 *
 * @example
 * ```ts
 * const { id, link } = await isa.account.cases.create({
 *   product: 'zyins',
 *   payload: { input: currentCaseToJSON() },
 * });
 * // `link` is `https://app.isaapi.com/c/<id>#k=<key>` — send it to the client.
 * ```
 */
export declare function create(request: CaseCreateRequest, ctx: CasesContext): Promise<CaseCreateResult>;
/**
 * Resolve a share link: parse the id and fragment key, fetch the opaque
 * envelope, and decrypt locally. A 404 (absent or expired — indistinguishable
 * by design) raises {@link IsaCaseExpiredError}.
 *
 * @example
 * ```ts
 * const { product, payload } = await isa.account.cases.open(link);
 * ```
 */
export declare function open(link: string, ctx: CasesContext): Promise<CaseOpenResult>;
/**
 * List the caller's cases (account-scoped metadata only). The list never
 * carries ciphertext — the owner cannot decrypt a case without its link's
 * fragment key.
 *
 * @example
 * ```ts
 * const cases = await isa.account.cases.list();
 * cases.forEach((c) => console.log(c.id, c.product, c.expiresAt));
 * ```
 */
export declare function list(ctx: CasesContext): Promise<CaseSummary[]>;
/**
 * Email a case link to a recipient.
 *
 * @example
 * ```ts
 * await isa.account.cases.email({ caseId: id, to: 'jane.smith@example.com' });
 * ```
 */
export declare function email(request: CaseEmailRequest, ctx: CasesContext): Promise<CaseEmailResult>;
//# sourceMappingURL=cases.d.ts.map