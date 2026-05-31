/**
 * Structured proxy-call helper. Wraps httpRequest with the `/v1/call` envelope
 * shape and the Algosure HMAC headers required by the platform proxy.
 */
import { type Clock } from '../../core/index.js';
export interface ProxyCallParams {
    /** e.g., "https://proxy.isaapi.com" */
    proxyOrigin: string;
    /** Integration identifier registered in the proxy registry. */
    integrationId: string;
    /** The inner request params, forwarded in the envelope body. */
    params: {
        path: string;
        method: string;
        headers?: Record<string, string>;
        body?: unknown;
    };
    /** The *Host value (customer domain for salt resolution). */
    host: string;
    /** Session identifier for Algosure binding. */
    sessionId: string;
    /** Optional clock facade for Algosure timestamp derivation. */
    clock?: Clock;
    /** Optional fetch override (for tests). */
    fetchImpl?: typeof fetch;
    /** Optional SubtleCrypto override (for tests/node). */
    subtle?: SubtleCrypto;
    /** Optional request timeout in ms. */
    timeout?: number;
    /**
     * Optional abort signal for the salt-proxy fetch. Prefer this when a caller
     * already owns a signal (e.g., from a parent timeout controller).
     */
    signal?: AbortSignal;
    /**
     * Optional salt-proxy timeout in ms. If provided, the salt fetch is aborted
     * after the timeout so header generation cannot block indefinitely.
     */
    saltTimeout?: number;
}
export interface ProxyCallResponse {
    status: number;
    headers: Record<string, string>;
    body: unknown;
}
/**
 * Issues a POST {proxyOrigin}/v1/call with the structured
 * `{integration_id, params}` envelope, signed with Algosure HMAC headers.
 */
export declare function proxyCall(params: ProxyCallParams): Promise<ProxyCallResponse>;
//# sourceMappingURL=call.d.ts.map