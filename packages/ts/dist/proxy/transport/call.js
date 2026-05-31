/**
 * Structured proxy-call helper. Wraps httpRequest with the `/v1/call` envelope
 * shape and the Algosure HMAC headers required by the platform proxy.
 */
import { buildAlgosureHeaders } from '../algosure/hmac.js';
import { HttpRequestError, httpRequest } from '../../core/index.js';
import { REQUEST, RETURN_TYPE } from '../../core/index.js';
const PROXY_CALL_PATH = '/v1/call';
/**
 * Issues a POST {proxyOrigin}/v1/call with the structured
 * `{integration_id, params}` envelope, signed with Algosure HMAC headers.
 */
export async function proxyCall(params) {
    const url = `${params.proxyOrigin.replace(/\/$/, '')}${PROXY_CALL_PATH}`;
    const envelope = {
        integration_id: params.integrationId,
        params: params.params,
    };
    const bodyStr = JSON.stringify(envelope);
    const authArgs = {
        host: params.host,
        method: REQUEST.POST,
        path: PROXY_CALL_PATH,
        body: bodyStr,
        sessionId: params.sessionId,
        ...(params.clock !== undefined ? { clock: params.clock } : {}),
        ...(params.fetchImpl !== undefined ? { fetchImpl: params.fetchImpl } : {}),
        ...(params.subtle !== undefined ? { subtle: params.subtle } : {}),
        ...(params.signal !== undefined ? { signal: params.signal } : {}),
        ...(params.saltTimeout !== undefined ? { saltTimeout: params.saltTimeout } : {}),
    };
    const headers = await buildAlgosureHeaders(authArgs);
    // The caller's signal MUST flow through to the main request too, not only
    // to the salt fetch — otherwise cancelling the operation only interrupts
    // header generation and the /v1/call request continues in the background.
    const otherArgs = {
        headers: { 'Content-Type': 'application/json', ...headers },
        ...(params.signal !== undefined ? { signal: params.signal } : {}),
    };
    const response = await httpRequest({
        url,
        method: REQUEST.POST,
        // Pass the pre-serialized string so the signed bytes in `headers` match the
        // bytes on the wire exactly. Passing `envelope` would let httpRequest
        // re-serialize it, and any future non-determinism in JSON.stringify
        // (key ordering, replacer) would break the HMAC.
        body: bodyStr,
        returnType: RETURN_TYPE.JSON,
        otherArgs,
        ...(params.fetchImpl !== undefined ? { fetchImpl: params.fetchImpl } : {}),
        ...(params.timeout !== undefined ? { timeout: params.timeout } : {}),
    });
    if (!isProxyCallResponse(response)) {
        throw new HttpRequestError('proxyCall: malformed response from proxy');
    }
    return response;
}
function isProxyCallResponse(value) {
    if (!isPlainObject(value))
        return false;
    if (typeof value.status !== 'number')
        return false;
    if (!isStringRecord(value.headers))
        return false;
    return Object.prototype.hasOwnProperty.call(value, 'body');
}
function isStringRecord(value) {
    if (!isPlainObject(value))
        return false;
    return Object.values(value).every((v) => typeof v === 'string');
}
// JavaScript's `typeof [] === 'object'` returns true, and `Object.values(array)`
// returns the array's elements. An array of strings therefore passes a naive
// `isStringRecord` check — but `response.headers['content-type']` on that array
// returns `undefined`, silently breaking downstream lookups. Reject arrays (and
// null) explicitly so callers always see real Record<string, string> shape.
function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
//# sourceMappingURL=call.js.map