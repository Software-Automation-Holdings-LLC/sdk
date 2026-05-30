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
import { encryptCase, decryptCase } from './caseCrypto';
import { assembleLink, parseLink, parseCreatedId, parseCaseDetail, parseCaseList, } from './caseWire';
import { signedCaseRequest, isSuccess } from './caseTransport';
import { fromHttpResponse } from '../zyins/errors';
import { IsaCaseExpiredError } from '../zyins/apiError';
const CASE_PATH = '/v1/case';
const CASE_LIST_PATH = '/v1/case/list';
const HTTP_NOT_FOUND = 404;
/**
 * Default share-link viewer origin. The SDK appends `/c/<id>#k=<key>`; the
 * base intentionally omits the `/c/` segment so a deployment can point the
 * option at any host without re-encoding the path shape.
 */
export const DEFAULT_CASE_VIEWER_BASE_URL = 'https://app.isaapi.com';
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
export async function create(request, ctx) {
    if (!request || typeof request.product !== 'string' || request.product.length === 0) {
        throw new Error('account: cases.create requires a product');
    }
    if (request.payload === undefined) {
        throw new Error('account: cases.create requires a payload');
    }
    const { envelope, keyFragment } = await encryptCase(request.product, request.payload);
    const body = JSON.stringify({ product: request.product, ...envelope });
    const response = await signedCaseRequest({ method: 'POST', path: CASE_PATH, body, idempotencyOp: 'cases_create' }, ctx);
    if (!isSuccess(response.status)) {
        throw fromHttpResponse(response.status, response.body);
    }
    const id = parseCreatedId(response.body);
    return { id, link: assembleLink(ctx.caseViewerBaseUrl, id, keyFragment) };
}
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
export async function open(link, ctx) {
    const { id, keyFragment } = parseLink(link);
    const path = `${CASE_PATH}/${encodeURIComponent(id)}`;
    const response = await signedCaseRequest({ method: 'GET', path, body: '' }, ctx);
    if (response.status === HTTP_NOT_FOUND) {
        throw new IsaCaseExpiredError(id);
    }
    if (!isSuccess(response.status)) {
        throw fromHttpResponse(response.status, response.body);
    }
    const { product, envelope } = parseCaseDetail(response.body);
    const payload = await decryptCase(product, envelope, keyFragment);
    return { product, payload };
}
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
export async function list(ctx) {
    const response = await signedCaseRequest({ method: 'POST', path: CASE_LIST_PATH, body: '{}' }, ctx);
    if (!isSuccess(response.status)) {
        throw fromHttpResponse(response.status, response.body);
    }
    return parseCaseList(response.body);
}
/**
 * Email a case link to a recipient.
 *
 * @example
 * ```ts
 * await isa.account.cases.email({ caseId: id, to: 'jane.smith@example.com' });
 * ```
 */
export async function email(request, ctx) {
    if (!request || typeof request.caseId !== 'string' || request.caseId.length === 0) {
        throw new Error('account: cases.email requires a non-empty caseId');
    }
    if (typeof request.to !== 'string' || request.to.length === 0) {
        throw new Error('account: cases.email requires a non-empty to address');
    }
    const path = `${CASE_PATH}/${encodeURIComponent(request.caseId)}/email`;
    const body = JSON.stringify({ to: request.to });
    const response = await signedCaseRequest({ method: 'POST', path, body, idempotencyOp: `cases_email:${request.caseId}` }, ctx);
    if (isSuccess(response.status)) {
        return { queued: true };
    }
    throw fromHttpResponse(response.status, response.body);
}
//# sourceMappingURL=cases.js.map