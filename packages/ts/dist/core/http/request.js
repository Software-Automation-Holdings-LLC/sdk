/**
 * Framework-agnostic HTTP request helper with pluggable auth injection and
 * transient-vs-fatal error tagging. Ported from bpp2.0 src/lib/web/httpRequest.ts.
 *
 * Framework-specific concerns (AsyncStorage, TanStack Query, logger) live
 * behind injectable facades so the same primitive serves web, React Native,
 * and Node.
 */
import { DEFAULT_FETCH_TIMEOUT_MS, REQUEST, RETURN_TYPE } from './constants.js';
import { resolveFetch as resolveFetchFacade } from '../internal/crypto.js';
/** Context label passed to runtime resolvers for error attribution. */
const HTTP_CONTEXT = 'http';
/** Status codes whose bodies MUST be empty per RFC 7230/9110. */
const EMPTY_BODY_STATUSES = new Set([204, 205, 304]);
const noopLogger = {
    debug: () => undefined,
    error: () => undefined,
};
const systemTimer = {
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (h) => clearTimeout(h),
};
/**
 * Error enhanced with transport metadata. Transient errors (timeouts, network
 * blips) MAY be retried; non-transient errors (CORS, 4xx) MUST NOT be retried
 * without operator intervention.
 */
export class HttpRequestError extends Error {
    status;
    statusText;
    responseText;
    isTransient;
    isCORS;
    originalError;
    constructor(message, opts = {}) {
        super(message);
        this.name = 'HttpRequestError';
        if (opts.status !== undefined)
            this.status = opts.status;
        if (opts.statusText !== undefined)
            this.statusText = opts.statusText;
        if (opts.responseText !== undefined)
            this.responseText = opts.responseText;
        this.isTransient = opts.isTransient ?? false;
        this.isCORS = opts.isCORS ?? false;
        if (opts.originalError !== undefined)
            this.originalError = opts.originalError;
    }
}
/**
 * Execute an HTTP request with auth injection, timeout, and error tagging.
 *
 * - Auth headers: optional pluggable applier (see {@link ApplyAuthHeaders}).
 * - Timeout: aborts after `timeout` ms (default 5s) and surfaces a transient
 *   HttpRequestError.
 * - Caller `otherArgs.signal`: composed with the timeout signal; if the caller
 *   aborts, the resulting HttpRequestError is tagged non-transient. Timeout
 *   aborts remain transient.
 * - Network errors: tagged with isTransient=true.
 * - CORS errors: tagged with isCORS=true, isTransient=false.
 * - 4xx responses: surfaced with `status`, non-transient.
 * - 5xx responses: surfaced with `status`, transient (safe to retry).
 */
export async function httpRequest(opts) {
    const { url, method = REQUEST.GET, body, otherArgs = {}, returnType = RETURN_TYPE.JSON, debug = false, timeout = DEFAULT_FETCH_TIMEOUT_MS, applyAuthHeaders, fetchImpl, logger = noopLogger, timer = systemTimer } = opts;
    if (!url) {
        const err = new HttpRequestError('URL is required for httpRequest');
        if (debug)
            logger.error('httpRequest error', { error: err, method, body, otherArgs });
        throw err;
    }
    const f = resolveFetchFacade(fetchImpl, HTTP_CONTEXT);
    const timeoutController = new AbortController();
    const timeoutHandle = timer.setTimeout(() => timeoutController.abort(), timeout);
    const callerSignal = otherArgs.signal ?? undefined;
    const { signal, cleanup: cleanupSignal } = composeSignals(timeoutController.signal, callerSignal);
    try {
        const hasBody = body != null && method !== REQUEST.GET && method !== REQUEST.HEAD;
        const encoded = hasBody ? encodeBody(body) : { wireBody: undefined, authBody: '', contentType: undefined };
        const requestInit = {
            method,
            mode: 'cors',
            credentials: 'omit',
            ...otherArgs,
            signal,
        };
        if (encoded.wireBody !== undefined)
            requestInit.body = encoded.wireBody;
        // When we auto-serialize a plain object to JSON, set Content-Type so
        // servers parse the payload correctly. Never clobber a caller-supplied
        // value — the caller's intent wins.
        if (encoded.contentType !== undefined) {
            requestInit.headers = withDefaultContentType(requestInit.headers, encoded.contentType);
        }
        requestInit.headers = applyAuthHeaders ? await applyAuthHeaders(url, requestInit.headers, encoded.authBody) : requestInit.headers;
        if (debug) {
            logger.debug(`Making ${method} request to: ${url}`, {
                method,
                body: requestInit.body,
                otherArgs,
            });
        }
        const response = await f(url, requestInit);
        if (!response.ok && !EMPTY_BODY_STATUSES.has(response.status)) {
            const errorText = await safeReadText(response);
            const err = new HttpRequestError(`HTTP error! status: ${response.status} - ${response.statusText}`, {
                status: response.status,
                statusText: response.statusText,
                responseText: errorText,
                isTransient: response.status >= 500,
            });
            if (debug) {
                logger.error(`HTTP error for ${url}`, {
                    error: err,
                    method,
                    status: response.status,
                    statusText: response.statusText,
                    responseText: errorText,
                    requestBody: requestInit.body,
                });
            }
            throw err;
        }
        return (await parseResponse(response, returnType, url, logger, debug));
    }
    catch (error) {
        throw enhanceError(error, {
            url,
            method,
            timeout,
            logger,
            debug,
            timeoutSignal: timeoutController.signal,
            callerSignal,
        });
    }
    finally {
        timer.clearTimeout(timeoutHandle);
        cleanupSignal();
    }
}
/**
 * Combines an internal timeout signal with a caller-supplied signal so either
 * can abort the request. Prefers `AbortSignal.any` when available; otherwise
 * falls back to manual propagation so older runtimes (Node <20, older browsers)
 * still honor the caller's cancellation.
 */
function composeSignals(timeoutSignal, callerSignal) {
    if (!callerSignal)
        return { signal: timeoutSignal, cleanup: () => undefined };
    const anyFactory = AbortSignal.any;
    if (typeof anyFactory === 'function')
        return { signal: anyFactory([timeoutSignal, callerSignal]), cleanup: () => undefined };
    const controller = new AbortController();
    let timeoutHandler;
    let callerHandler;
    const relay = (src) => {
        if (src.aborted) {
            controller.abort(src.reason);
            return;
        }
        const handler = () => controller.abort(src.reason);
        src.addEventListener('abort', handler, { once: true });
        if (src === timeoutSignal) {
            timeoutHandler = handler;
        }
        else {
            callerHandler = handler;
        }
    };
    relay(timeoutSignal);
    relay(callerSignal);
    const cleanup = () => {
        if (timeoutHandler)
            timeoutSignal.removeEventListener('abort', timeoutHandler);
        if (callerHandler)
            callerSignal.removeEventListener('abort', callerHandler);
    };
    return { signal: controller.signal, cleanup };
}
/**
 * Splits the caller-supplied body into the on-wire representation and the
 * string that `applyAuthHeaders` receives for signing.
 *
 * - `string`: passed through untouched; auth sees the same bytes on the wire.
 * - Native `BodyInit` types (`Blob`, `FormData`, `URLSearchParams`,
 *   `ArrayBuffer`, typed arrays, `ReadableStream`): passed through; auth sees
 *   an empty string because these payloads are not meaningfully signable
 *   without the caller pre-serializing them. Callers that need to sign these
 *   MUST serialize first and pass a string.
 * - Everything else (plain objects): JSON-stringified; auth sees the same
 *   JSON string that goes on the wire.
 */
function encodeBody(body) {
    if (typeof body === 'string')
        return { wireBody: body, authBody: body, contentType: undefined };
    if (isNativeBodyInit(body))
        return { wireBody: body, authBody: '', contentType: undefined };
    const json = JSON.stringify(body);
    return { wireBody: json, authBody: json, contentType: 'application/json' };
}
/**
 * Applies `Content-Type: <value>` to `headers` only if no Content-Type (in any
 * case) is already present. Accepts all HeadersInit shapes (Headers, array,
 * record) and returns a shape the caller's downstream code can consume.
 */
function withDefaultContentType(headers, value) {
    if (!headers)
        return { 'Content-Type': value };
    if (headers instanceof Headers) {
        if (headers.has('Content-Type'))
            return headers;
        const cloned = new Headers(headers);
        cloned.set('Content-Type', value);
        return cloned;
    }
    if (Array.isArray(headers)) {
        const hasCT = headers.some(([k]) => k.toLowerCase() === 'content-type');
        return hasCT ? headers : [...headers, ['Content-Type', value]];
    }
    const record = headers;
    const hasCT = Object.keys(record).some((k) => k.toLowerCase() === 'content-type');
    return hasCT ? record : { ...record, 'Content-Type': value };
}
function isNativeBodyInit(value) {
    if (value === null || typeof value !== 'object')
        return false;
    const g = globalThis;
    if (typeof g.Blob === 'function' && value instanceof g.Blob)
        return true;
    if (typeof g.FormData === 'function' && value instanceof g.FormData)
        return true;
    if (typeof g.URLSearchParams === 'function' && value instanceof g.URLSearchParams)
        return true;
    if (typeof g.ReadableStream === 'function' && value instanceof g.ReadableStream)
        return true;
    if (value instanceof ArrayBuffer)
        return true;
    if (ArrayBuffer.isView(value))
        return true;
    return false;
}
/**
 * Reads the response as JSON, treating no-content statuses (204, 205, 304)
 * and empty bodies as `undefined`. Any JSON.parse failure surfaces as a
 * SyntaxError that the caller's try/catch converts into an HttpRequestError
 * carrying the parse failure as `originalError`.
 */
async function parseJsonBody(response) {
    if (EMPTY_BODY_STATUSES.has(response.status))
        return undefined;
    const text = await response.text();
    if (text.length === 0)
        return undefined;
    return JSON.parse(text);
}
async function safeReadText(response) {
    try {
        return await response.text();
    }
    catch {
        return '';
    }
}
async function parseResponse(response, returnType, url, logger, debug) {
    try {
        // No-content statuses (204, 205, 304) return `undefined` regardless of
        // the requested returnType — they have no body to parse.
        if (EMPTY_BODY_STATUSES.has(response.status))
            return undefined;
        switch (returnType) {
            case RETURN_TYPE.TEXT:
                return await response.text();
            case RETURN_TYPE.BLOB:
                return await response.blob();
            case RETURN_TYPE.JSON:
            default:
                return await parseJsonBody(response);
        }
    }
    catch (parseError) {
        const err = new HttpRequestError(`Failed to parse ${returnType} response from ${url}`, { originalError: parseError });
        if (debug) {
            logger.error(`Error parsing response from ${url}`, {
                error: err,
                originalError: parseError,
                returnType,
                responseStatus: response.status,
            });
        }
        throw err;
    }
}
function enhanceError(error, ctx) {
    // Already enhanced — pass through without logging (already logged at creation point).
    if (error instanceof HttpRequestError) {
        return error;
    }
    // Timeout vs. caller-initiated abort: attribute to the caller only when a
    // caller signal exists and is the one that fired. If no caller signal was
    // supplied, any AbortError originated from our timeout.
    if (error instanceof DOMException && error.name === 'AbortError') {
        // Priority order: if the caller's signal has aborted, attribute to the
        // caller (retry is NOT safe — the caller asked us to stop). Otherwise
        // attribute to the timeout. This avoids retrying a cancelled request
        // merely because a coincident deadline also fired.
        const callerAborted = ctx.callerSignal?.aborted ?? false;
        const timedOut = !callerAborted;
        const message = timedOut ? `Request to ${ctx.url} timed out after ${ctx.timeout}ms` : `Request to ${ctx.url} was aborted by caller`;
        const abortErr = new HttpRequestError(message, { originalError: error, isTransient: timedOut });
        if (ctx.debug)
            ctx.logger.error(`Abort for ${ctx.url}`, { error: abortErr, timedOut });
        return abortErr;
    }
    // Network / CORS — TypeError is the signal in browsers and most runtimes.
    if (error instanceof TypeError) {
        const msg = error.message.toLowerCase();
        const isNetwork = msg.includes('load failed') || msg.includes('network request failed') || msg.includes('failed to fetch');
        const isCORS = msg.includes('cors') || msg.includes('blocked by cors policy');
        const hostname = extractHostname(ctx.url);
        if (isCORS) {
            const corsErr = new HttpRequestError(`CORS error: ${hostname} is not configured to allow cross-origin requests from this domain`, { originalError: error, isCORS: true, isTransient: false });
            if (error.stack)
                corsErr.stack = error.stack;
            if (ctx.debug) {
                ctx.logger.error(`CORS error for ${ctx.url}`, {
                    error: corsErr,
                    hostname,
                    suggestion: 'The server needs to add Access-Control-Allow-Origin headers',
                });
            }
            return corsErr;
        }
        if (isNetwork) {
            const netErr = new HttpRequestError(`Network error loading resource from ${hostname}: ${error.message}`, { originalError: error, isTransient: true });
            if (error.stack)
                netErr.stack = error.stack;
            if (ctx.debug)
                ctx.logger.error(`Transient network error for ${ctx.url}`, { error: netErr });
            return netErr;
        }
    }
    if (ctx.debug)
        ctx.logger.error(`Error fetching ${ctx.url}`, { error, method: ctx.method });
    return error instanceof Error ? error : new Error(String(error));
}
function extractHostname(url) {
    try {
        return new URL(url).hostname;
    }
    catch {
        return url;
    }
}
//# sourceMappingURL=request.js.map