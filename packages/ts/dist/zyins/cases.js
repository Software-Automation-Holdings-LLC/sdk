/**
 * Tier 3 cases operations — `POST /v1/case`.
 *
 * Cases are content-addressed shareable artifacts created from a quote
 * input + results + selected products. The server hashes the (xml,
 * results, products) tuple — identical inputs dedupe to the same `hash`
 * regardless of which license created the case. ZIP+4 fields are stripped
 * from the input before hashing.
 *
 * Today this module exposes `create`; the existing `case.email` Tier-3
 * helper is re-exported via the `cases` sub-client for case-share email.
 * Future `list` / `get` / `delete` RPCs require new server work (see the
 * design doc; tracked as issue #149 follow-ups).
 */
import { fromHttpResponse } from './errors';
import { deriveIdempotencyKey } from './idempotency';
import { isRecord, parseJsonResponse, unwrapEnvelope } from './response';
import { buildLicenseHMACHeaders } from '../core';
import { systemClock } from '../core';
const CASE_PATH = '/v1/case';
/** Create a new shareable case. */
export async function create(request, ctx) {
    if (!request || request.input === undefined || request.input === null) {
        throw new Error('zyins: cases.create requires input');
    }
    const wire = { input: request.input };
    if (request.results !== undefined)
        wire['results'] = request.results;
    if (request.products !== undefined)
        wire['products'] = request.products;
    const body = JSON.stringify(wire);
    const idempotencyKey = ctx.idempotencyKey ??
        (await deriveIdempotencyKey({ deviceId: ctx.auth.deviceId, op: 'cases_create', body }));
    const headers = await buildLicenseHMACHeaders(ctx.auth.licenseKey, ctx.auth.orderId, ctx.auth.email, 'POST', CASE_PATH, body, ctx.auth.deviceId, ctx.clock ?? systemClock);
    const response = await ctx.transport({
        url: `${ctx.baseUrl}${CASE_PATH}`,
        method: 'POST',
        headers: {
            ...headers,
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'Idempotency-Key': idempotencyKey,
        },
        body,
    });
    if (response.status >= 200 && response.status < 300) {
        return parseCreateResponse(response.body);
    }
    throw fromHttpResponse(response.status, response.body);
}
function parseCreateResponse(body) {
    if (!body) {
        throw new Error('zyins: cases.create response body was empty');
    }
    const parsed = parseJsonResponse(body, 'cases.create');
    const root = unwrapEnvelope(parsed);
    if (!isRecord(root)) {
        throw new Error('zyins: cases.create response body was not an object');
    }
    return {
        object: typeof root['object'] === 'string' ? root['object'] : 'case',
        hash: typeof root['hash'] === 'string' ? root['hash'] : '',
        url: typeof root['url'] === 'string' ? root['url'] : '',
        readonly: root['readonly'] === true,
        createdAt: typeof root['created_at'] === 'string' ? root['created_at'] : '',
    };
}
//# sourceMappingURL=cases.js.map