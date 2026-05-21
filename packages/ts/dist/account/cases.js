/**
 * `isa.account.cases` — case CRUD + share over `/v1/case`.
 *
 *   create  → `POST   /v1/case`
 *   get     → `GET    /v1/case/{id}`
 *   list    → `GET    /v1/case`
 *   email   → `POST   /v1/case/{id}/email`
 *
 * Cases are content-addressed shareable artifacts created from a quote
 * input + results + selected products. The server hashes the tuple —
 * identical inputs dedupe to the same `hash` regardless of which license
 * created the case.
 */
import { fromHttpResponse } from '../zyins/errors';
import { deriveIdempotencyKey } from '../zyins/idempotency';
import { isRecord, stringField, unwrapEnvelope } from '../zyins/response';
import { buildLicenseHMACHeaders } from '../core';
import { systemClock } from '../core';
const CASES_PATH = '/v1/case';
/** Create a new shareable case. */
export async function create(request, ctx) {
    if (!request ||
        request.input === undefined ||
        request.input === null ||
        (typeof request.input === 'string' && request.input.trim().length === 0)) {
        throw new Error('account: cases.create requires input');
    }
    const wire = { input: request.input };
    if (request.results !== undefined)
        wire['results'] = request.results;
    if (request.products !== undefined)
        wire['products'] = request.products;
    const body = JSON.stringify(wire);
    const idempotencyKey = ctx.idempotencyKey ??
        (await deriveIdempotencyKey({ deviceId: ctx.auth.deviceId, op: 'cases_create', body }));
    const headers = await buildLicenseHMACHeaders(ctx.auth.licenseKey, ctx.auth.orderId, ctx.auth.email, 'POST', CASES_PATH, body, ctx.auth.deviceId, ctx.clock ?? systemClock);
    const response = await ctx.transport({
        url: `${ctx.baseUrl}${CASES_PATH}`,
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
/** Retrieve a single case by hash. */
export async function get(caseId, ctx) {
    if (typeof caseId !== 'string' || caseId.length === 0) {
        throw new Error('account: cases.get requires a non-empty case id');
    }
    const path = `${CASES_PATH}/${encodeURIComponent(caseId)}`;
    const headers = await buildLicenseHMACHeaders(ctx.auth.licenseKey, ctx.auth.orderId, ctx.auth.email, 'GET', path, '', ctx.auth.deviceId, ctx.clock ?? systemClock);
    const response = await ctx.transport({
        url: `${ctx.baseUrl}${path}`,
        method: 'GET',
        headers: { ...headers, Accept: 'application/json' },
        body: '',
    });
    if (response.status >= 200 && response.status < 300) {
        return parseCaseSummary(response.body);
    }
    throw fromHttpResponse(response.status, response.body);
}
/** List all cases visible to the caller. */
export async function list(ctx) {
    const headers = await buildLicenseHMACHeaders(ctx.auth.licenseKey, ctx.auth.orderId, ctx.auth.email, 'GET', CASES_PATH, '', ctx.auth.deviceId, ctx.clock ?? systemClock);
    const response = await ctx.transport({
        url: `${ctx.baseUrl}${CASES_PATH}`,
        method: 'GET',
        headers: { ...headers, Accept: 'application/json' },
        body: '',
    });
    if (response.status >= 200 && response.status < 300) {
        return parseCaseList(response.body);
    }
    throw fromHttpResponse(response.status, response.body);
}
/** Email a case PDF / artifact to a recipient. */
export async function email(request, ctx) {
    if (!request || typeof request.caseId !== 'string' || request.caseId.length === 0) {
        throw new Error('account: cases.email requires a non-empty caseId');
    }
    if (typeof request.to !== 'string' || request.to.length === 0) {
        throw new Error('account: cases.email requires a non-empty to address');
    }
    const path = `${CASES_PATH}/${encodeURIComponent(request.caseId)}/email`;
    const body = JSON.stringify({ to: request.to });
    const idempotencyKey = ctx.idempotencyKey ??
        (await deriveIdempotencyKey({
            deviceId: ctx.auth.deviceId,
            op: `cases_email:${request.caseId}`,
            body,
        }));
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
        return { queued: true };
    }
    throw fromHttpResponse(response.status, response.body);
}
function parseCreateResponse(body) {
    if (!body) {
        throw new Error('account: cases.create response body was empty');
    }
    const parsed = parseCaseJson(body, 'account: cases.create');
    const root = caseRecord(parsed, 'account: cases.create');
    return {
        hash: stringField(root, 'hash'),
        url: stringField(root, 'url'),
        readonly: root['readonly'] === true,
        createdAt: stringField(root, 'created_at'),
    };
}
function parseCaseSummary(body) {
    if (!body) {
        throw new Error('account: cases.get response body was empty');
    }
    const parsed = parseCaseJson(body, 'account: cases.get');
    const root = caseRecord(parsed, 'account: cases.get');
    return summaryFromRecord(root);
}
function parseCaseList(body) {
    if (!body)
        return [];
    const parsed = parseCaseJson(body, 'account: cases.list');
    const root = unwrapEnvelope(parsed);
    if (Array.isArray(root)) {
        return root.map((entry) => summaryFromRecord(entry));
    }
    if (root && typeof root === 'object' && 'cases' in root) {
        const cases = root.cases;
        if (Array.isArray(cases)) {
            return cases.map((entry) => summaryFromRecord(entry));
        }
    }
    return [];
}
function parseCaseJson(body, context) {
    try {
        return JSON.parse(body);
    }
    catch (err) {
        throw new Error(`${context} response was not valid JSON: ${err.message}`);
    }
}
function caseRecord(parsed, context) {
    const root = unwrapEnvelope(parsed);
    if (!isRecord(root)) {
        throw new Error(`${context} response body was not a JSON object`);
    }
    return root;
}
function summaryFromRecord(r) {
    const out = {
        hash: stringField(r, 'hash'),
        url: stringField(r, 'url'),
        readonly: r['readonly'] === true,
        createdAt: stringField(r, 'created_at'),
    };
    if (r['input'] !== undefined)
        out.input = r['input'];
    if (r['results'] !== undefined)
        out.results = r['results'];
    if (Array.isArray(r['products']))
        out.products = r['products'];
    return out;
}
//# sourceMappingURL=cases.js.map