/**
 * Signed-request dispatch for the `/v1/case` operations. Centralizes the
 * License-HMAC header construction + transport call so each operation in
 * `cases.ts` only assembles its body and routes status codes.
 */
import { deriveIdempotencyKey } from '../zyins/idempotency';
import { buildLicenseHMACHeaders, systemClock } from '../core';
/**
 * Build License-HMAC headers and dispatch one `/v1/case` request, eliminating
 * the per-operation header/transport boilerplate. The caller routes status
 * codes — this helper only signs and sends.
 */
export async function signedCaseRequest(spec, ctx) {
    const headers = await buildLicenseHMACHeaders(ctx.auth.licenseKey, ctx.auth.orderId, ctx.auth.email, spec.method, spec.path, spec.body, ctx.auth.deviceId, ctx.clock ?? systemClock);
    const requestHeaders = { ...headers, Accept: 'application/json' };
    if (spec.method === 'POST')
        requestHeaders['Content-Type'] = 'application/json';
    if (spec.idempotencyOp !== undefined) {
        requestHeaders['Idempotency-Key'] =
            ctx.idempotencyKey ??
                (await deriveIdempotencyKey({
                    deviceId: ctx.auth.deviceId,
                    op: spec.idempotencyOp,
                    body: spec.body,
                }));
    }
    return ctx.transport({
        url: `${ctx.baseUrl}${spec.path}`,
        method: spec.method,
        headers: requestHeaders,
        body: spec.body,
    });
}
/** True when an HTTP status is a 2xx success. */
export function isSuccess(status) {
    return status >= 200 && status < 300;
}
//# sourceMappingURL=caseTransport.js.map