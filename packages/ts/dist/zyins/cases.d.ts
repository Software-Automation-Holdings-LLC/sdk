/**
 * Tier 3 zyins case share — the zyins-flavored sugar over the zero-knowledge
 * `/v1/case` store (E2EE Phase 2).
 *
 * `share` pins `product: 'zyins'`, shapes the payload as
 * `{ input, results?, products? }`, and delegates to the shared opaque-case
 * `create` in `../account/cases`. The payload is encrypted client-side; the
 * server stores opaque ciphertext and never sees the key. The result is the
 * case id plus the fragment-keyed share link.
 *
 * HARD RULE — no key/fragment leakage: the link is returned as a value only.
 * It is never logged, never put on a telemetry payload, and never attached to
 * a thrown error. See `../account/cases` for the enforced guarantee.
 */
import { type AuthContext } from './auth';
import { type Transport } from './transport';
import { type Clock } from '../core';
/**
 * Inputs for `cases.share`. `input` is the quote payload; `results` and
 * `products` are an optional analysis snapshot. All three are encrypted
 * together — the server never reads any of them.
 */
export interface CaseShareRequest {
    input: Record<string, unknown> | string;
    results?: unknown;
    products?: string[];
}
/** Result of `cases.share`: the case id and assembled fragment-keyed link. */
export interface CaseShareResult {
    /** Server-assigned case uuid. */
    id: string;
    /** Full share link `${caseViewerBaseUrl}/c/<id>#k=<base64url(key)>`. */
    link: string;
}
export interface CasesContext {
    baseUrl: string;
    /** Viewer origin for share-link assembly; threaded from the namespace. */
    caseViewerBaseUrl: string;
    auth: AuthContext;
    transport: Transport;
    clock: Clock;
    idempotencyKey?: string;
}
/**
 * Share a zyins case: encrypt `{ input, results?, products? }` under a fresh
 * key, store the opaque envelope, and return the fragment-keyed link.
 *
 * @example
 * ```ts
 * const { id, link } = await isa.zyins.cases.share({
 *   input: currentCaseToJSON(),
 *   results: currentAnalysisResult,
 *   products: ['colonial-penn'],
 * });
 * ```
 */
export declare function share(request: CaseShareRequest, ctx: CasesContext): Promise<CaseShareResult>;
//# sourceMappingURL=cases.d.ts.map