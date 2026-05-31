/**
 * Transport facade for the Tier 3 RapidSign client.
 *
 * Wraps `@isa-sdk/core`'s `resolveFetch` so the SDK never calls `fetch`
 * directly. Tests inject a stub; Node environments without a global fetch
 * pass their own implementation through `new ISA(key, { fetch: ... })`.
 *
 * Header assembly is the caller's responsibility; this facade moves bytes.
 */
import { resolveFetch } from '../../core/index.js';
/**
 * Build the default transport. Tests pass `fetchImpl` to avoid the global.
 * The returned function always lowercases response header keys so the
 * client's lookups (`headers['x-request-id']`) are case-insensitive.
 */
export function defaultTransport(fetchImpl) {
    const f = resolveFetch(fetchImpl, 'RapidSignTransport');
    return async (request) => {
        const init = {
            method: request.method,
            headers: request.headers,
        };
        if (request.method !== 'GET' && request.method !== 'DELETE') {
            init.body = request.body;
        }
        if (request.signal) {
            init.signal = request.signal;
        }
        const response = await f(request.url, init);
        const body = await response.text();
        const headers = {};
        response.headers.forEach((value, key) => {
            headers[key.toLowerCase()] = value;
        });
        return { status: response.status, body, headers };
    };
}
//# sourceMappingURL=transport.js.map