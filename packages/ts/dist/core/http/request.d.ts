/**
 * Framework-agnostic HTTP request helper with pluggable auth injection and
 * transient-vs-fatal error tagging. Ported from bpp2.0 src/lib/web/httpRequest.ts.
 *
 * Framework-specific concerns (AsyncStorage, TanStack Query, logger) live
 * behind injectable facades so the same primitive serves web, React Native,
 * and Node.
 */
import { type RequestMethod, type HttpReturnType } from './constants.js';
/** Structured logger facade. Callers can inject console, pino, winston, etc. */
export interface Logger {
    debug: (msg: string, ctx?: unknown) => void;
    error: (msg: string, ctx?: unknown) => void;
}
/** Opaque handle returned by Timer.setTimeout, consumed by Timer.clearTimeout. */
export type TimerHandle = ReturnType<typeof setTimeout>;
/** Timer facade — abstracts setTimeout / clearTimeout for testability. */
export interface Timer {
    setTimeout: (fn: () => void, ms: number) => TimerHandle;
    clearTimeout: (handle: TimerHandle) => void;
}
/**
 * Pluggable auth-header applier. Given the outbound URL, current headers, and
 * the serialized body, return the headers the request should use. Return the
 * input unchanged to apply no auth.
 */
export type ApplyAuthHeaders = (url: string, existingHeaders: HeadersInit | undefined, requestBody: string) => Promise<HeadersInit | undefined> | HeadersInit | undefined;
export interface HttpRequestOptions {
    url: string;
    method?: RequestMethod;
    body?: unknown;
    otherArgs?: RequestInit;
    returnType?: HttpReturnType;
    debug?: boolean;
    timeout?: number;
    /** Optional auth-header applier. Default: pass-through. */
    applyAuthHeaders?: ApplyAuthHeaders;
    /** Optional fetch override. Default: globalThis.fetch. */
    fetchImpl?: typeof fetch;
    /** Optional logger. Default: noop. */
    logger?: Logger;
    /** Optional timer (for tests). Default: system setTimeout/clearTimeout. */
    timer?: Timer;
}
/**
 * Error enhanced with transport metadata. Transient errors (timeouts, network
 * blips) MAY be retried; non-transient errors (CORS, 4xx) MUST NOT be retried
 * without operator intervention.
 */
export declare class HttpRequestError extends Error {
    readonly status?: number;
    readonly statusText?: string;
    readonly responseText?: string;
    readonly isTransient: boolean;
    readonly isCORS: boolean;
    readonly originalError?: unknown;
    constructor(message: string, opts?: {
        status?: number;
        statusText?: string;
        responseText?: string;
        isTransient?: boolean;
        isCORS?: boolean;
        originalError?: unknown;
    });
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
export declare function httpRequest<T = unknown>(opts: HttpRequestOptions): Promise<T>;
//# sourceMappingURL=request.d.ts.map