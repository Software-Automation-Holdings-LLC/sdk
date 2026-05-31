/*
 * Algosure HMAC Authentication (ported from eapp-system)
 * (c) 2024-2026 SOFTWARE AUTOMATION HOLDINGS, LLC. All Rights Reserved.
 * Patent pending.
 *
 * HMAC-based replacement for the AES-chain authentication scheme.
 * Binds the signature to the specific request (method, path, body,
 * timestamp, session) to prevent replay, tampering, and cross-endpoint
 * reuse.
 */

import { resolveFetch, resolveSubtle, arrayBufferToHex, type Clock, systemClock } from '../../core/index.js';

/** Context label passed to runtime resolvers for error attribution. */
const ALGOSURE_CONTEXT = 'Algosure';

/** 30-second buckets for clock-skew tolerance. Must match server. */
export const ALGOSURE_TIME_BUCKET_MS = 30_000;

/** Default proxy for fetching the rotating salt. */
export const DEFAULT_SALT_PROXY_URL = 'https://isaapi.com/proxy/get-authorizer-content';

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
export async function computeAlgosureHMAC(args: AlgosureHMACArgs): Promise<[string, number]> {
    const clock = args.clock ?? systemClock;
    const timestamp = args.time ?? clock();
    const subtle = resolveSubtle(args.subtle, ALGOSURE_CONTEXT);

    const saltContent = await fetchSaltContent({
        host: args.host,
        proxyUrl: args.saltProxyUrl,
        fetchImpl: args.fetchImpl,
        signal: args.signal,
        timeoutMs: args.saltTimeout,
    });
    if (!saltContent || saltContent.length === 0) {
        throw new Error('Algosure: empty salt content from host');
    }

    const simpleKey = deriveSimpleKey(saltContent, timestamp);

    let bodyStr: string = '';
    if (args.body != null) {
        bodyStr = typeof args.body === 'string' ? args.body : JSON.stringify(args.body);
    }
    const bodyHash = await sha256Hex(bodyStr, subtle);

    // Null-delimited fields, matching server-side verification order.
    const message = [args.method || 'POST', args.path || '/', bodyHash, String(timestamp), args.sessionId || ''].join('\x00');

    const hmacTag = await hmacSHA256(simpleKey, message, subtle);
    return [hmacTag, timestamp];
}

/**
 * Builds the full Algosure authentication headers for a request.
 */
export async function buildAlgosureHeaders(args: AlgosureHMACArgs): Promise<AlgosureHeaders> {
    const [hmacTag, timestamp] = await computeAlgosureHMAC(args);
    return {
        'Authorization': hmacTag,
        '*Host': args.host,
        '*Timestamp': String(timestamp),
        '*sessionId': args.sessionId,
    };
}

/**
 * Derives a simple key from the salt content using a time-bucketed index.
 * Must match the server-side derivation in auth/algosure/algosure.go.
 *
 * Exported for unit testing and advanced use; callers should prefer
 * computeAlgosureHMAC / buildAlgosureHeaders.
 */
export function deriveSimpleKey(saltContent: string, timestampMs: number): string {
    const bucket = Math.floor(timestampMs / ALGOSURE_TIME_BUCKET_MS);
    const digitSum = String(Math.abs(bucket))
        .split('')
        .reduce((sum, d) => sum + Number.parseInt(d, 10), 0);
    const keyLen = Math.max(8, digitSum || 1);
    const start = ((bucket % saltContent.length) + saltContent.length) % saltContent.length;

    let key = '';
    for (let i = 0; i < keyLen; i++) {
        key += saltContent[(start + i) % saltContent.length];
    }
    return key;
}

interface SaltFetchConfig {
    host: string;
    proxyUrl?: string | undefined;
    fetchImpl?: typeof fetch | undefined;
    signal?: AbortSignal | undefined;
    timeoutMs?: number | undefined;
}

async function fetchSaltContent(cfg: SaltFetchConfig): Promise<string> {
    const f = resolveFetch(cfg.fetchImpl, ALGOSURE_CONTEXT);
    const url = cfg.proxyUrl ?? DEFAULT_SALT_PROXY_URL;
    const { signal, cancel } = buildSaltSignal(cfg.signal, cfg.timeoutMs);
    try {
        const response = await f(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ Target: cfg.host, Return: 'Text', RequestType: 'GET' }),
            ...(signal ? { signal } : {}),
        });
        if (!response.ok) {
            throw new Error(`Algosure: salt fetch failed with status ${response.status}`);
        }
        return await response.text();
    } finally {
        cancel();
    }
}

function buildSaltSignal(caller: AbortSignal | undefined, timeoutMs: number | undefined): { signal?: AbortSignal; cancel: () => void } {
    if (timeoutMs === undefined) {
        return caller ? { signal: caller, cancel: () => undefined } : { cancel: () => undefined };
    }
    const controller = new AbortController();
    const handle = setTimeout(() => controller.abort(), timeoutMs);
    let abortHandler: (() => void) | undefined;
    if (caller) {
        if (caller.aborted) {
            controller.abort();
        } else {
            abortHandler = () => controller.abort();
            caller.addEventListener('abort', abortHandler, { once: true });
        }
    }
    const cancel = (): void => {
        clearTimeout(handle);
        if (abortHandler && caller) {
            caller.removeEventListener('abort', abortHandler);
        }
    };
    return { signal: controller.signal, cancel };
}

async function hmacSHA256(key: string, message: string, subtle: SubtleCrypto): Promise<string> {
    const encoder = new TextEncoder();
    const cryptoKey = await subtle.importKey('raw', encoder.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = await subtle.sign('HMAC', cryptoKey, encoder.encode(message));
    return arrayBufferToHex(signature);
}

async function sha256Hex(data: string, subtle: SubtleCrypto): Promise<string> {
    const encoder = new TextEncoder();
    const hashBuffer = await subtle.digest('SHA-256', encoder.encode(data));
    return arrayBufferToHex(hashBuffer);
}
