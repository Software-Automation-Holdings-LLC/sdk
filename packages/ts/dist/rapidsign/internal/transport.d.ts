/**
 * Transport facade for the Tier 3 RapidSign client.
 *
 * Wraps `@isa-sdk/core`'s `resolveFetch` so the SDK never calls `fetch`
 * directly. Tests inject a stub; Node environments without a global fetch
 * pass their own implementation through `new ISA(key, { fetch: ... })`.
 *
 * Header assembly is the caller's responsibility; this facade moves bytes.
 */
/** Supported HTTP methods. */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
/** Outbound request as seen by the transport facade. */
export interface TransportRequest {
    readonly url: string;
    readonly method: HttpMethod;
    readonly headers: Record<string, string>;
    /** Serialized request body. Empty string for body-less verbs. */
    readonly body: string;
    /** Optional AbortSignal forwarded to `fetch`. */
    readonly signal?: AbortSignal;
}
/** Response surface returned to the client. Header keys are lowercased. */
export interface TransportResponse {
    readonly status: number;
    readonly body: string;
    readonly headers: Record<string, string>;
}
/** Pluggable transport facade. */
export type Transport = (request: TransportRequest) => Promise<TransportResponse>;
/**
 * Build the default transport. Tests pass `fetchImpl` to avoid the global.
 * The returned function always lowercases response header keys so the
 * client's lookups (`headers['x-request-id']`) are case-insensitive.
 */
export declare function defaultTransport(fetchImpl?: typeof fetch): Transport;
//# sourceMappingURL=transport.d.ts.map