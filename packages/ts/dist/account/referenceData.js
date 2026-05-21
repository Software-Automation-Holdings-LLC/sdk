/**
 * `isa.account.referenceData` — engine reference data lookups.
 *
 * Three wire paths, one typed surface:
 *
 *   scope === 'dataset'           → `GET   /dataset/{dataset}`
 *   scope === 'compiled_data_v2'  → `POST  /v1/reference-data`
 *   scope === 'compiled_data_v3'  → `POST  /v2/reference-data`
 *   (other scope values)          → `POST  /v1/reference-data`
 *
 * The scope value is forwarded to the server in the request body for the
 * POST paths so the server can dispatch to the right compiled-data version.
 * For the GET path the `dataset` field selects the dataset by name; no body
 * is sent.
 *
 * Return shape is the server's verbatim JSON, unwrapped from the standard
 * `{ data: ... }` envelope when present. The common case is
 * `{ datasets: { ... } }`; some endpoints return a flat record. The SDK
 * does not interpret the payload — callers pick the fields they need.
 */
import { fromHttpResponse } from '../zyins/errors';
import { deriveIdempotencyKey } from '../zyins/idempotency';
import { unwrapEnvelope } from '../zyins/response';
import { buildLicenseHMACHeaders } from '../core';
import { systemClock } from '../core';
const REFERENCE_V1_PATH = '/v1/reference-data';
const REFERENCE_V2_PATH = '/v2/reference-data';
const DATASET_PREFIX = '/dataset/';
/** Fetch reference data per the supplied scope. */
export async function get(request, ctx) {
    if (!request || typeof request.scope !== 'string' || request.scope.length === 0) {
        throw new Error('account: referenceData.get requires a non-empty scope');
    }
    if (request.scope === 'dataset') {
        return fetchDataset(request, ctx);
    }
    return postReferenceData(request, ctx);
}
async function fetchDataset(request, ctx) {
    if (typeof request.dataset !== 'string' || request.dataset.length === 0) {
        throw new Error('account: referenceData.get(scope=dataset) requires a dataset name');
    }
    const path = `${DATASET_PREFIX}${encodeURIComponent(request.dataset)}`;
    const headers = await buildLicenseHMACHeaders(ctx.auth.licenseKey, ctx.auth.orderId, ctx.auth.email, 'GET', path, '', ctx.auth.deviceId, ctx.clock ?? systemClock);
    const response = await ctx.transport({
        url: `${ctx.baseUrl}${path}`,
        method: 'GET',
        headers: { ...headers, Accept: 'application/json' },
        body: '',
    });
    if (response.status >= 200 && response.status < 300) {
        return parseReferenceBody(response.body);
    }
    throw fromHttpResponse(response.status, response.body);
}
async function postReferenceData(request, ctx) {
    const path = pathForScope(request.scope);
    const wire = request.payload === undefined
        ? { scope: request.scope }
        : { ...request.payload, scope: request.scope };
    const body = JSON.stringify(wire);
    const idempotencyKey = await deriveIdempotencyKey({
        deviceId: ctx.auth.deviceId,
        op: `reference_data:${path}`,
        body,
    });
    const headers = await buildLicenseHMACHeaders(ctx.auth.licenseKey, ctx.auth.orderId, ctx.auth.email, 'POST', path, body, ctx.auth.deviceId, ctx.clock ?? systemClock);
    const response = await ctx.transport({
        url: `${ctx.baseUrl}${path}`,
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
        return parseReferenceBody(response.body);
    }
    throw fromHttpResponse(response.status, response.body);
}
function pathForScope(scope) {
    if (scope === 'compiled_data_v3')
        return REFERENCE_V2_PATH;
    return REFERENCE_V1_PATH;
}
function parseReferenceBody(body) {
    if (!body)
        return {};
    let parsed;
    try {
        parsed = JSON.parse(body);
    }
    catch (err) {
        throw new Error(`account: reference-data response was not valid JSON: ${err.message}`);
    }
    const root = unwrapEnvelope(parsed);
    if (root && typeof root === 'object' && !Array.isArray(root)) {
        return root;
    }
    return { data: root };
}
//# sourceMappingURL=referenceData.js.map