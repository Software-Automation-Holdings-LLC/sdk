/**
 * Tier 3 license operations — proto-backed (`/v1/licenses/activate`,
 * `/v1/licenses/check`, `/v1/licenses/deactivate`).
 *
 * The TS/JS surface is singular (`isa.zyins.license`) — a device has exactly
 * one license, not a collection. The wire paths remain plural for backward
 * compatibility with the deployed server; only the SDK names changed.
 *
 * The proto definitions for the request and response shapes live in
 * `shared/schemas/api/zyins/v1/licenses.proto`.
 */
import { fromHttpResponse } from './errors';
import { deriveIdempotencyKey } from './idempotency';
import { parseJsonResponse, unwrapEnvelope as unwrapParsedEnvelope } from './response';
import { buildLicenseHMACHeaders } from '../core';
import { systemClock } from '../core';
const LICENSES_ACTIVATE_PATH = '/v1/licenses/activate';
const LICENSES_CHECK_PATH = '/v1/licenses/check';
const LICENSES_DEACTIVATE_PATH = '/v1/licenses/deactivate';
const DEACTIVATED_STATUS = 'deactivated';
/**
 * Activate a license on a new device. The server mints a license key,
 * decrements the order's remaining-activations counter, and returns
 * pre-built credentials.
 */
export async function activate(request, ctx) {
    validateActivateRequest(request);
    const body = JSON.stringify(serializeActivate(request));
    const requestCtx = {
        ...ctx,
        auth: { ...ctx.auth, deviceId: request.deviceId },
    };
    const idempotencyKey = ctx.idempotencyKey ??
        (await deriveIdempotencyKey({ deviceId: request.deviceId, op: 'license_activate', body }));
    const headers = await buildHeaders({ ctx: requestCtx, body, path: LICENSES_ACTIVATE_PATH, idempotencyKey });
    const response = await ctx.transport({
        url: `${ctx.baseUrl}${LICENSES_ACTIVATE_PATH}`,
        method: 'POST',
        headers,
        body,
    });
    if (response.status >= 200 && response.status < 300) {
        return parseActivate(response.body);
    }
    throw fromHttpResponse(response.status, response.body);
}
/**
 * Run the public phone-home check. The server does not require
 * authentication; an attached bearer/HMAC header is harmless and lets
 * one client struct serve every operation.
 */
export async function check(request, ctx) {
    validateCheckRequest(request);
    const body = JSON.stringify(serializeCheck(request));
    const idempotencyKey = ctx.idempotencyKey ??
        (await deriveIdempotencyKey({ deviceId: ctx.auth.deviceId, op: 'license_check', body }));
    const headers = await buildHeaders({ ctx, body, path: LICENSES_CHECK_PATH, idempotencyKey });
    const response = await ctx.transport({
        url: `${ctx.baseUrl}${LICENSES_CHECK_PATH}`,
        method: 'POST',
        headers,
        body,
    });
    if (response.status >= 200 && response.status < 300) {
        return parseCheck(response.body);
    }
    throw fromHttpResponse(response.status, response.body);
}
/**
 * Run the public deactivation. Marks the activation inactive and
 * resets the anti-piracy device record.
 */
export async function deactivate(request, ctx) {
    validateDeactivateRequest(request);
    const body = JSON.stringify(serializeDeactivate(request));
    const idempotencyKey = ctx.idempotencyKey ??
        (await deriveIdempotencyKey({ deviceId: ctx.auth.deviceId, op: 'license_deactivate', body }));
    const headers = await buildHeaders({ ctx, body, path: LICENSES_DEACTIVATE_PATH, idempotencyKey });
    const response = await ctx.transport({
        url: `${ctx.baseUrl}${LICENSES_DEACTIVATE_PATH}`,
        method: 'POST',
        headers,
        body,
    });
    if (response.status >= 200 && response.status < 300) {
        return parseDeactivate(response.body);
    }
    throw fromHttpResponse(response.status, response.body);
}
function validateActivateRequest(request) {
    if (!request.email?.trim()) {
        throw new Error('zyins: license.activate requires email');
    }
    if (!request.keycode?.trim()) {
        throw new Error('zyins: license.activate requires keycode');
    }
    if (!request.deviceId?.trim()) {
        throw new Error('zyins: license.activate requires deviceId');
    }
}
function validateCheckRequest(request) {
    if (!request.email?.trim()) {
        throw new Error('zyins: license.check requires email');
    }
    if (!request.keycode?.trim()) {
        throw new Error('zyins: license.check requires keycode');
    }
}
function validateDeactivateRequest(request) {
    if (!request.email?.trim()) {
        throw new Error('zyins: license.deactivate requires email');
    }
    if (!request.keycode?.trim()) {
        throw new Error('zyins: license.deactivate requires keycode');
    }
}
function serializeActivate(request) {
    return {
        email: request.email,
        keycode: request.keycode,
        device_id: request.deviceId,
    };
}
function serializeCheck(request) {
    const payload = {
        email: request.email,
        keycode: request.keycode,
    };
    if (request.deviceId)
        payload['device_id'] = request.deviceId;
    if (request.licenseKey)
        payload['license_key'] = request.licenseKey;
    return payload;
}
function serializeDeactivate(request) {
    const payload = {
        email: request.email,
        keycode: request.keycode,
    };
    if (request.deviceId)
        payload['device_id'] = request.deviceId;
    return payload;
}
function parseActivate(body) {
    const data = unwrapEnvelope(body);
    const status = data.status;
    if (typeof status !== 'string' || status === '') {
        throw new Error('zyins: license.activate response missing status field');
    }
    const remaining = data.remaining_activations ?? data.remainingActivations;
    if (typeof remaining !== 'number') {
        throw new Error('zyins: license.activate response missing remainingActivations');
    }
    const auth = data.auth;
    if (!auth || typeof auth !== 'object') {
        throw new Error('zyins: license.activate response missing auth block');
    }
    const licenseKey = auth.license_key ?? auth.licenseKey;
    if (typeof licenseKey !== 'string' || licenseKey === '') {
        throw new Error('zyins: license.activate response missing auth.licenseKey');
    }
    return {
        status,
        auth: { licenseKey },
        remainingActivations: remaining,
    };
}
function parseCheck(body) {
    const data = unwrapEnvelope(body);
    const status = data.status;
    if (typeof status !== 'string') {
        throw new Error(`zyins: license.check response missing status field`);
    }
    return { status: status };
}
function parseDeactivate(body) {
    const data = unwrapEnvelope(body);
    const status = data.status;
    if (status !== DEACTIVATED_STATUS) {
        throw new Error('zyins: license.deactivate response missing deactivated status');
    }
    return { status };
}
function unwrapEnvelope(body) {
    if (!body) {
        throw new Error('zyins: license response body was empty');
    }
    return unwrapParsedEnvelope(parseJsonResponse(body, 'license'));
}
async function buildHeaders(args) {
    const signed = await buildLicenseHMACHeaders(args.ctx.auth.licenseKey, args.ctx.auth.orderId, args.ctx.auth.email, 'POST', args.path, args.body, args.ctx.auth.deviceId, args.ctx.clock ?? systemClock);
    return {
        ...signed,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Idempotency-Key': args.idempotencyKey,
    };
}
//# sourceMappingURL=license.js.map