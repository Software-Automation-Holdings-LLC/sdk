/**
 * Transport facade for the Tier 3 ZyINS client.
 *
 * The Tier 3 client must not call `fetch` directly. Tests, React-Native, and
 * Node-without-fetch all inject a custom transport. The shape here matches
 * what the protocol layer needs: method, URI path, body, and an out
 * parameter for response status + body string. Header assembly is the
 * client's responsibility (auth, idempotency, content-type); the transport
 * just moves bytes.
 *
 * The default implementation wraps the global `fetch`. The facade keeps
 * the client testable without pulling the wider `http/request.ts` machinery
 * (timeout handling, transient tagging) into Tier 3 — that is Tier 2's job,
 * and Tier 3 is allowed to assume the protocol layer above it is reliable.
 */
import { resolveFetch } from '../core/index.js';
/**
 * Construct the default transport. Accepts an optional `fetchImpl` override
 * so tests inject a stub without touching globals.
 */
export function defaultTransport(fetchImpl) {
    const f = resolveFetch(fetchImpl, 'ZyInsTransport');
    return async (request) => {
        const init = {
            method: request.method,
            headers: request.headers,
            signal: request.signal,
        };
        if (request.method !== 'GET' && request.method !== 'DELETE') {
            init.body = request.body;
        }
        const response = await f(request.url, init);
        const body = await response.text();
        const headers = {};
        response.headers.forEach((value, key) => {
            headers[key] = value;
        });
        return { status: response.status, body, headers };
    };
}
//# sourceMappingURL=transport.js.map