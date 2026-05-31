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
import { create as opaqueCreate, } from '../account/cases.js';
/** zyins routing tag pinned by {@link share}. */
const ZYINS_PRODUCT = 'zyins';
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
export async function share(request, ctx) {
    if (!request || request.input === undefined || request.input === null) {
        throw new Error('zyins: cases.share requires input');
    }
    const payload = { input: request.input };
    if (request.results !== undefined)
        payload['results'] = request.results;
    if (request.products !== undefined)
        payload['products'] = request.products;
    const result = await opaqueCreate({ product: ZYINS_PRODUCT, payload }, ctx);
    return { id: result.id, link: result.link };
}
//# sourceMappingURL=cases.js.map