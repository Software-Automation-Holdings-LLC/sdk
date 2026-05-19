import { type Clock } from '../../core';
/** 30-second buckets for clock-skew tolerance. Must match server. */
export declare const ALGOSURE_TIME_BUCKET_MS = 30000;
/** Default proxy for fetching the rotating salt. */
export declare const DEFAULT_SALT_PROXY_URL = "https://isaapi.com/proxy/get-authorizer-content";
export interface AlgosureHMACArgs {
    /** The *Host value (customer domain serving the salt). */
    host: string;
    /** HTTP method (GET, POST, etc.). */
    method: string;
    /** Request path (e.g., /v1/proxy/call). */
    path: string;
    /** Request body (string or object; objects are JSON-stringified). */
    body?: string | object | null;
    /** Session identifier. */
    sessionId: string;
    /** Explicit timestamp in ms. Takes precedence over clock. */
    time?: number;
    /** Injectable clock facade. Defaults to systemClock. */
    clock?: Clock;
    /** Optional override for the salt proxy URL (for tests and custom deployments). */
    saltProxyUrl?: string;
    /**
     * Optional fetch implementation. Defaults to globalThis.fetch. Inject in
     * environments without a global fetch (Node < 18, tests).
     */
    fetchImpl?: typeof fetch;
    /**
     * Optional SubtleCrypto instance. Defaults to globalThis.crypto.subtle.
     * Inject for environments that provide crypto on a different global.
     */
    subtle?: SubtleCrypto;
    /**
     * Optional abort signal for the salt-proxy fetch. Prefer this when a caller
     * already owns a signal (e.g., from a parent timeout controller).
     */
    signal?: AbortSignal;
    /**
     * Optional salt-proxy timeout in ms. If provided, the salt fetch is aborted
     * after the timeout so header generation cannot block an outer request
     * indefinitely.
     */
    saltTimeout?: number;
}
export type AlgosureHeaders = {
    'Authorization': string;
    '*Host': string;
    '*Timestamp': string;
    '*sessionId': string;
};
/**
 * Computes an HMAC-SHA256 authentication tag for an Algosure-authenticated
 * request.
 *
 * @returns [hexHmacTag, timestampUsed]
 */
export declare function computeAlgosureHMAC(args: AlgosureHMACArgs): Promise<[string, number]>;
/**
 * Builds the full Algosure authentication headers for a request.
 */
export declare function buildAlgosureHeaders(args: AlgosureHMACArgs): Promise<AlgosureHeaders>;
/**
 * Derives a simple key from the salt content using a time-bucketed index.
 * Must match the server-side derivation in auth/algosure/algosure.go.
 *
 * Exported for unit testing and advanced use; callers should prefer
 * computeAlgosureHMAC / buildAlgosureHeaders.
 */
export declare function deriveSimpleKey(saltContent: string, timestampMs: number): string;
//# sourceMappingURL=hmac.d.ts.map