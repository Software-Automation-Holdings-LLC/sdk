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
import { resolveFetch, resolveSubtle, arrayBufferToHex, systemClock } from '../../core';
/** Context label passed to runtime resolvers for error attribution. */
const ALGOSURE_CONTEXT = 'Algosure';
/** 30-second buckets for clock-skew tolerance. Must match server. */
export const ALGOSURE_TIME_BUCKET_MS = 30_000;
/** Default proxy for fetching the rotating salt. */
export const DEFAULT_SALT_PROXY_URL = 'https://isaapi.com/proxy/get-authorizer-content';
/**
 * Computes an HMAC-SHA256 authentication tag for an Algosure-authenticated
 * request.
 *
 * @returns [hexHmacTag, timestampUsed]
 */
export async function computeAlgosureHMAC(args) {
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
    let bodyStr = '';
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
export async function buildAlgosureHeaders(args) {
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
export function deriveSimpleKey(saltContent, timestampMs) {
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
async function fetchSaltContent(cfg) {
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
    }
    finally {
        cancel();
    }
}
function buildSaltSignal(caller, timeoutMs) {
    if (timeoutMs === undefined) {
        return caller ? { signal: caller, cancel: () => undefined } : { cancel: () => undefined };
    }
    const controller = new AbortController();
    const handle = setTimeout(() => controller.abort(), timeoutMs);
    let abortHandler;
    if (caller) {
        if (caller.aborted) {
            controller.abort();
        }
        else {
            abortHandler = () => controller.abort();
            caller.addEventListener('abort', abortHandler, { once: true });
        }
    }
    const cancel = () => {
        clearTimeout(handle);
        if (abortHandler && caller) {
            caller.removeEventListener('abort', abortHandler);
        }
    };
    return { signal: controller.signal, cancel };
}
async function hmacSHA256(key, message, subtle) {
    const encoder = new TextEncoder();
    const cryptoKey = await subtle.importKey('raw', encoder.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = await subtle.sign('HMAC', cryptoKey, encoder.encode(message));
    return arrayBufferToHex(signature);
}
async function sha256Hex(data, subtle) {
    const encoder = new TextEncoder();
    const hashBuffer = await subtle.digest('SHA-256', encoder.encode(data));
    return arrayBufferToHex(hashBuffer);
}
//# sourceMappingURL=hmac.js.map