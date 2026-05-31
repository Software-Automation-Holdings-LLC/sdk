import type { FetchImpl } from './bearer.js';
/** Returns the current instant in ms since epoch. */
export type Clock = () => number;
/** Sleeps for a duration. Tests inject a recording fake. */
export interface Sleeper {
    sleep(ms: number, signal?: AbortSignal): Promise<void>;
}
/** Default sleeper backed by setTimeout. Honors AbortSignal for cancellation. */
export declare const systemSleeper: Sleeper;
export interface RetryConfig {
    /** Total attempts including the first. Defaults to 5. */
    maxAttempts?: number;
    /** First backoff interval in ms; doubles each retry. Defaults to 250ms. */
    baseDelayMs?: number;
    /** Cap on exponential backoff in ms. Defaults to 8000ms. */
    maxDelayMs?: number;
    /** Clock for HTTP-date Retry-After arithmetic. Defaults to Date.now. */
    clock?: Clock;
    /** Sleeper implementation. Defaults to systemSleeper. */
    sleeper?: Sleeper;
}
/**
 * RetryTransport composes over an existing FetchImpl, retrying eligible
 * failures. Eligibility: 429, any 5xx. The inner fetch is invoked on
 * each attempt; callers wishing to share a single Request body across
 * attempts should pass a string/ArrayBuffer body (not a stream).
 */
export declare class RetryTransport {
    private readonly inner;
    private readonly maxAttempts;
    private readonly baseDelayMs;
    private readonly maxDelayMs;
    private readonly clock;
    private readonly sleeper;
    constructor(inner: FetchImpl, cfg?: RetryConfig);
    /** Returns a FetchImpl that retries on 429/5xx. */
    asFetch(): FetchImpl;
    private computeDelay;
}
/**
 * Parses an RFC 9110 Retry-After header. Returns ms, or undefined when
 * the header is absent / malformed so the caller falls back to
 * exponential backoff.
 */
export declare function parseRetryAfter(raw: string | null, nowMs: number): number | undefined;
//# sourceMappingURL=retry.d.ts.map