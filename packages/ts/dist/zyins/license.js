/**
 * Tier 3 license operations — bootstrap endpoints at
 * `/v2/licenses/{activate,check,deactivate}`.
 *
 * These three operations sit OUTSIDE AuthMiddleware on the server: activate
 * is the call that MINTS the licenseKey, so we cannot sign requests with a
 * credential we do not yet have. Headers carry only Idempotency-Key and the
 * device id; no HMAC signature, no Authorization header.
 *
 * The public TypeScript shape for `LicenseActivateResult` is preserved for
 * bpp2.0's `useSoftwareActivator.js`, which reads `result.auth.licenseKey`.
 * Only the wire parsing adapts to the v2 envelope shape.
 */
import { fromHttpResponse } from './errors.js';
import { deriveIdempotencyKey } from './idempotency.js';
import { parseJsonResponse, unwrapEnvelope as unwrapParsedEnvelope } from './response.js';
import { stripQuotes } from '../core/license/deviceAuth.js';
const LICENSES_ACTIVATE_PATH = '/v2/licenses/activate';
const LICENSES_CHECK_PATH = '/v2/licenses/check';
const LICENSES_DEACTIVATE_PATH = '/v2/licenses/deactivate';
const DEACTIVATED_STATUS = 'inactive';
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
        deviceId: request.deviceId,
    };
}
function serializeCheck(request) {
    const payload = {
        email: request.email,
        keycode: request.keycode,
    };
    if (request.deviceId)
        payload['deviceId'] = request.deviceId;
    if (request.licenseKey)
        payload['licenseKey'] = request.licenseKey;
    return payload;
}
function serializeDeactivate(request) {
    const payload = {
        email: request.email,
        keycode: request.keycode,
    };
    if (request.deviceId)
        payload['deviceId'] = request.deviceId;
    return payload;
}
function parseActivate(body) {
    const data = unwrapEnvelope(body);
    const status = data.status;
    if (typeof status !== 'string' || status === '') {
        throw new Error('zyins: license.activate response missing status field');
    }
    const licenseKey = typeof data.licenseKey === 'string' ? data.licenseKey : '';
    const remainingActivations = typeof data.remainingActivations === 'number' ? data.remainingActivations : 0;
    return {
        status,
        auth: { licenseKey },
        remainingActivations,
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
    // v2 returns "inactive" on success; accept the legacy "deactivated" too
    // so a server still serving the old wire word does not break consumers.
    if (status !== DEACTIVATED_STATUS && status !== 'deactivated') {
        throw new Error('zyins: license.deactivate response missing inactive status');
    }
    return { status: status };
}
function unwrapEnvelope(body) {
    if (!body) {
        throw new Error('zyins: license response body was empty');
    }
    return unwrapParsedEnvelope(parseJsonResponse(body, 'license'));
}
// buildHeaders emits ONLY the bootstrap-safe headers for the v2 license
// endpoints. These three operations sit outside AuthMiddleware on the
// server: activate is what mints the licenseKey, so signing here would
// require a credential the client does not yet have. The server tracks
// the activation slot by X-Device-ID; no Authorization, no signature.
function buildHeaders(args) {
    const headers = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Idempotency-Key': args.idempotencyKey,
    };
    const deviceId = args.ctx.auth.deviceId;
    if (deviceId) {
        headers['X-Device-ID'] = stripQuotes(deviceId);
    }
    return headers;
}
//# sourceMappingURL=license.js.map