/**
 * Wire helpers for the zero-knowledge case store: share-link assembly +
 * parsing, and response decoding for `/v1/case`. Kept separate from the
 * operation logic in `cases.ts` so each file stays focused (link/​parse vs.
 * transport orchestration).
 *
 * The link is the capability: it carries the case id in the path and the
 * decryption key in the `#k=` fragment. These helpers never log it.
 */
import { isRecord, parseJsonResponse, stringField, unwrapEnvelope } from '../zyins/response.js';
const FRAGMENT_KEY_PREFIX = '#k=';
const LEGACY_CASE_ROUTE_SEGMENT = 'c';
/**
 * Assemble `${base}/<code>#k=<keyFragment>`, normalizing a trailing slash on
 * the viewer base. The code is the only path segment the SDK adds; any product
 * prefix rides inside the configured base URL — this never adds one.
 */
export function assembleLink(viewerBaseUrl, code, keyFragment) {
    const base = viewerBaseUrl.replace(/\/$/, '');
    return `${base}/${encodeURIComponent(code)}${FRAGMENT_KEY_PREFIX}${keyFragment}`;
}
/**
 * Parse a share link into its case id and fragment key. Accepts both the
 * current single-segment shape (`{base}/<code>#k=<key>`) and the legacy
 * `{base}/c/<id>#k=<key>` shape, so links shared before the format change keep
 * opening. The id/code is the last non-empty path segment.
 */
export function parseLink(link) {
    if (typeof link !== 'string' || link.length === 0) {
        throw new Error('account: cases.open requires a non-empty link');
    }
    const hashAt = link.indexOf(FRAGMENT_KEY_PREFIX);
    if (hashAt < 0) {
        throw new Error('account: cases.open link is missing its #k= fragment key');
    }
    const keyFragment = link.slice(hashAt + FRAGMENT_KEY_PREFIX.length);
    if (keyFragment.length === 0) {
        throw new Error('account: cases.open link has an empty #k= fragment key');
    }
    const path = pathBeforeFragment(link.slice(0, hashAt));
    const segments = path
        .split('/')
        .filter((s) => s.length > 0);
    const id = segments.at(-1);
    if (id === undefined || id.length === 0 || id === LEGACY_CASE_ROUTE_SEGMENT) {
        throw new Error('account: cases.open link must carry a case id before #k=<key>');
    }
    return { id: decodeURIComponent(id), keyFragment };
}
function pathBeforeFragment(linkPrefix) {
    try {
        return new URL(linkPrefix).pathname;
    }
    catch {
        return linkPrefix;
    }
}
/** Decode a create response into the server-assigned case id. */
export function parseCreatedId(body) {
    return requiredStringField(caseRecord(body, 'cases.create'), 'id', 'cases.create');
}
/** Decode a `GET /v1/case/{uuid}` response into its product + opaque envelope. */
export function parseCaseDetail(body) {
    const root = caseRecord(body, 'cases.open');
    return {
        product: requiredStringField(root, 'product', 'cases.open'),
        envelope: {
            ciphertext: requiredStringField(root, 'ciphertext', 'cases.open'),
            iv: requiredStringField(root, 'iv', 'cases.open'),
            tag: requiredStringField(root, 'tag', 'cases.open'),
        },
    };
}
/** Decode a list response into metadata rows (ciphertext is never present). */
export function parseCaseList(body) {
    if (!body) {
        throw new Error('account: cases.list response body was empty');
    }
    const root = unwrapEnvelope(parseJsonResponse(body, 'cases.list'));
    if (!Array.isArray(root)) {
        throw new Error('account: cases.list response body did not contain a data array');
    }
    return root.map((entry, index) => {
        if (!isRecord(entry)) {
            throw new Error(`account: cases.list response row ${index} was not a JSON object`);
        }
        return {
            id: requiredStringField(entry, 'id', 'cases.list'),
            product: requiredStringField(entry, 'product', 'cases.list'),
            createdAt: requiredStringField(entry, 'created_at', 'cases.list'),
            expiresAt: requiredStringField(entry, 'expires_at', 'cases.list'),
        };
    });
}
/** Parse a non-empty body into an object, with operation-tagged errors. */
function caseRecord(body, operation) {
    if (!body) {
        throw new Error(`account: ${operation} response body was empty`);
    }
    const root = unwrapEnvelope(parseJsonResponse(body, operation));
    if (!isRecord(root)) {
        throw new Error(`account: ${operation} response body was not a JSON object`);
    }
    return root;
}
function requiredStringField(record, key, operation) {
    const value = stringField(record, key);
    if (value.length === 0) {
        throw new Error(`account: ${operation} response body is missing "${key}"`);
    }
    return value;
}
//# sourceMappingURL=caseWire.js.map