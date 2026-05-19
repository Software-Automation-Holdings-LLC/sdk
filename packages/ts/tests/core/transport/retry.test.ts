import { describe, expect, it, vi } from 'vitest';
import { RetryTransport, parseRetryAfter, type Sleeper, type Clock } from '../../../src/core/transport/retry';
import type { FetchImpl } from '../../../src/core/transport/bearer';

// Sleep ms used in tests; chosen tiny so timeouts don't blow up CI.
const TEST_BASE_DELAY_MS = 10;
const TEST_MAX_DELAY_MS = 10_000;

interface ScriptedStep {
    status?: number;
    retryAfter?: string;
    body?: string;
    error?: Error;
}

function scriptedFetch(steps: ScriptedStep[]): { fetch: FetchImpl; calls: () => number } {
    let idx = 0;
    return {
        fetch: async () => {
            const step = steps[idx];
            idx++;
            if (!step) throw new Error('scriptedFetch: out of steps');
            if (step.error) throw step.error;
            const headers: Record<string, string> = {};
            if (step.retryAfter !== undefined) headers['Retry-After'] = step.retryAfter;
            return new Response(step.body ?? '', { status: step.status ?? 200, headers });
        },
        calls: () => idx,
    };
}

function recordingSleeper(): { sleeper: Sleeper; durations: () => number[] } {
    const calls: number[] = [];
    return {
        sleeper: {
            async sleep(ms) {
                calls.push(ms);
            },
        },
        durations: () => calls,
    };
}

describe('RetryTransport happy path', () => {
    it('treats non-positive maxAttempts as the default (matches Go)', async () => {
        const steps = Array.from({ length: 5 }, () => ({ status: 429 as const }));
        const { fetch, calls } = scriptedFetch(steps);
        const { sleeper, durations } = recordingSleeper();
        const rt = new RetryTransport(fetch, {
            maxAttempts: 0,
            baseDelayMs: TEST_BASE_DELAY_MS,
            sleeper,
        });
        const resp = await rt.asFetch()('http://example/v1/x');
        expect(calls()).toBe(5);
        expect(resp.status).toBe(429);
        expect(durations()).toHaveLength(4);
    });

    it('returns the first response when not retriable', async () => {
        const { fetch, calls } = scriptedFetch([{ status: 200, body: 'ok' }]);
        const { sleeper, durations } = recordingSleeper();
        const rt = new RetryTransport(fetch, { baseDelayMs: TEST_BASE_DELAY_MS, sleeper });
        const resp = await rt.asFetch()('http://example/v1/x');
        expect(resp.status).toBe(200);
        expect(calls()).toBe(1);
        expect(durations()).toEqual([]);
    });
});

describe('RetryTransport on 429', () => {
    it('retries until success and honors Retry-After delta-seconds', async () => {
        const { fetch, calls } = scriptedFetch([
            { status: 429, retryAfter: '1' },
            { status: 429, retryAfter: '2' },
            { status: 200, body: 'ok' },
        ]);
        const { sleeper, durations } = recordingSleeper();
        const rt = new RetryTransport(fetch, { baseDelayMs: TEST_BASE_DELAY_MS, sleeper });
        const resp = await rt.asFetch()('http://example/v1/x');
        expect(resp.status).toBe(200);
        expect(calls()).toBe(3);
        expect(durations()).toEqual([1_000, 2_000]);
    });

    it('returns the last retriable response with a readable body after exhausting attempts', async () => {
        const { fetch, calls } = scriptedFetch([
            { status: 429, retryAfter: '1' },
            { status: 429, retryAfter: '1' },
            { status: 429, retryAfter: '1' },
            { status: 429, body: 'rate limited' },
        ]);
        const { sleeper, durations } = recordingSleeper();
        const rt = new RetryTransport(fetch, {
            maxAttempts: 4,
            baseDelayMs: TEST_BASE_DELAY_MS,
            maxDelayMs: TEST_MAX_DELAY_MS,
            sleeper,
        });
        const resp = await rt.asFetch()('http://example/v1/x');
        expect(calls()).toBe(4);
        expect(resp.status).toBe(429);
        expect(durations()).toEqual([1_000, 1_000, 1_000]);
        await expect(resp.text()).resolves.toBe('rate limited');
    });
});

describe('RetryTransport on 5xx without Retry-After', () => {
    it('uses exponential backoff capped at maxDelayMs', async () => {
        const { fetch } = scriptedFetch([
            { status: 503 },
            { status: 503 },
            { status: 200, body: 'ok' },
        ]);
        const { sleeper, durations } = recordingSleeper();
        const rt = new RetryTransport(fetch, { baseDelayMs: TEST_BASE_DELAY_MS, maxDelayMs: TEST_MAX_DELAY_MS, sleeper });
        await rt.asFetch()('http://example/v1/x');
        expect(durations()).toEqual([TEST_BASE_DELAY_MS, TEST_BASE_DELAY_MS * 2]);
    });
});

describe('RetryTransport with HTTP-date Retry-After', () => {
    it('computes delta against the injected clock', async () => {
        const fixedNow = Date.UTC(2026, 0, 1, 12, 0, 0);
        const retryAt = new Date(fixedNow + 3_000).toUTCString();
        const { fetch } = scriptedFetch([
            { status: 429, retryAfter: retryAt },
            { status: 200, body: 'ok' },
        ]);
        const { sleeper, durations } = recordingSleeper();
        const clock: Clock = () => fixedNow;
        const rt = new RetryTransport(fetch, { baseDelayMs: TEST_BASE_DELAY_MS, maxDelayMs: TEST_MAX_DELAY_MS, sleeper, clock });
        await rt.asFetch()('http://example/v1/x');
        expect(durations()).toHaveLength(1);
        // Allow ±1s slack for HTTP-date second-granularity.
        expect(durations()[0]).toBeGreaterThanOrEqual(2_000);
        expect(durations()[0]).toBeLessThanOrEqual(4_000);
    });
});

describe('RetryTransport exhausts retries', () => {
    it('rethrows the last error', async () => {
        const netErr = new Error('connection reset');
        const { fetch } = scriptedFetch(Array(4).fill({ error: netErr }));
        const { sleeper } = recordingSleeper();
        const rt = new RetryTransport(fetch, { maxAttempts: 4, baseDelayMs: TEST_BASE_DELAY_MS, sleeper });
        await expect(rt.asFetch()('http://example/v1/x')).rejects.toThrow(netErr);
    });

    it('does not throw a stale error after a later successful attempt', async () => {
        const timeout = new Error('timeout');
        const { fetch } = scriptedFetch([{ error: timeout }, { status: 200, body: 'ok' }]);
        const { sleeper } = recordingSleeper();
        const rt = new RetryTransport(fetch, { maxAttempts: 4, baseDelayMs: TEST_BASE_DELAY_MS, sleeper });
        const resp = await rt.asFetch()('http://example/v1/x');
        expect(resp.status).toBe(200);
        await expect(resp.text()).resolves.toBe('ok');
    });

    it('does not reuse Retry-After from a prior response after a transport error', async () => {
        const netErr = new Error('connection reset');
        const { fetch } = scriptedFetch([
            { status: 429, retryAfter: '1' },
            { error: netErr },
            { status: 200, body: 'ok' },
        ]);
        const { sleeper, durations } = recordingSleeper();
        const rt = new RetryTransport(fetch, { maxAttempts: 4, baseDelayMs: TEST_BASE_DELAY_MS, sleeper });
        const resp = await rt.asFetch()('http://example/v1/x');
        expect(resp.status).toBe(200);
        expect(durations()).toEqual([1_000, TEST_BASE_DELAY_MS * 2]);
    });
});

describe('parseRetryAfter', () => {
    it('parses positive delta-seconds', () => {
        expect(parseRetryAfter('30', 0)).toBe(30_000);
    });

    it('rejects negative deltas', () => {
        expect(parseRetryAfter('-5', 0)).toBeUndefined();
    });

    it('parses HTTP-date relative to clock', () => {
        const now = Date.UTC(2026, 0, 1, 0, 0, 0);
        const future = new Date(now + 5_000).toUTCString();
        expect(parseRetryAfter(future, now)).toBeGreaterThan(0);
    });

    it('rejects garbage', () => {
        expect(parseRetryAfter('not-a-date', 0)).toBeUndefined();
    });

    it('returns undefined for null', () => {
        expect(parseRetryAfter(null, 0)).toBeUndefined();
    });
});

describe('RetryTransport ctor', () => {
    it('rejects a missing inner fetch', () => {
        expect(() => new RetryTransport(undefined as unknown as FetchImpl)).toThrow();
    });

    it('does not call setTimeout when not retrying', async () => {
        const spy = vi.spyOn(globalThis, 'setTimeout');
        const { fetch } = scriptedFetch([{ status: 200, body: 'ok' }]);
        const rt = new RetryTransport(fetch);
        await rt.asFetch()('http://example/v1/x');
        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
    });
});
