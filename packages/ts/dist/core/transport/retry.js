/*
 * Retry transport with Retry-After awareness for the unified ISA SDK.
 *
 * Retries on 429 and 5xx responses. Honors Retry-After in both
 * delta-seconds and HTTP-date forms (RFC 9110 §10.2.3). Falls back to
 * exponential backoff capped at MaxDelay when Retry-After is absent or
 * malformed. The clock and sleeper are injectable so tests assert the
 * backoff schedule without burning wall-clock time.
 */
/** Default sleeper backed by setTimeout. Honors AbortSignal for cancellation. */
export const systemSleeper = {
    sleep(ms, signal) {
        if (ms <= 0)
            return Promise.resolve();
        return new Promise((resolve, reject) => {
            const handle = setTimeout(() => {
                signal?.removeEventListener('abort', onAbort);
                resolve();
            }, ms);
            const onAbort = () => {
                clearTimeout(handle);
                reject(new Error('transport: retry sleeper aborted'));
            };
            signal?.addEventListener('abort', onAbort, { once: true });
        });
    },
};
// Mirrors aws-sdk-go-v2's standard retry mode tuned for the eApp client.
const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_BASE_DELAY_MS = 250;
const DEFAULT_MAX_DELAY_MS = 8_000;
/**
 * RetryTransport composes over an existing FetchImpl, retrying eligible
 * failures. Eligibility: 429, any 5xx. The inner fetch is invoked on
 * each attempt; callers wishing to share a single Request body across
 * attempts should pass a string/ArrayBuffer body (not a stream).
 */
export class RetryTransport {
    inner;
    maxAttempts;
    baseDelayMs;
    maxDelayMs;
    clock;
    sleeper;
    constructor(inner, cfg = {}) {
        if (!inner) {
            throw new Error('transport: RetryTransport requires an inner fetch');
        }
        this.inner = inner;
        const maxAttempts = cfg.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
        this.maxAttempts =
            Number.isFinite(maxAttempts) && maxAttempts > 0 ? maxAttempts : DEFAULT_MAX_ATTEMPTS;
        this.baseDelayMs = cfg.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
        this.maxDelayMs = cfg.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
        this.clock = cfg.clock ?? Date.now;
        this.sleeper = cfg.sleeper ?? systemSleeper;
    }
    /** Returns a FetchImpl that retries on 429/5xx. */
    asFetch() {
        return async (input, init) => {
            let lastResp;
            let lastErr;
            for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
                if (attempt > 1) {
                    const delay = this.computeDelay(lastResp, attempt - 1);
                    await this.sleeper.sleep(delay, init?.signal ?? undefined);
                }
                try {
                    const resp = await this.inner(input, init);
                    lastErr = undefined;
                    if (!shouldRetry(resp.status)) {
                        return resp;
                    }
                    lastResp = resp;
                    const hasMoreAttempts = attempt < this.maxAttempts;
                    if (hasMoreAttempts) {
                        // Drain the body so the underlying connection can
                        // be reused (matches Stripe-node's retry path).
                        try {
                            await resp.text();
                        }
                        catch {
                            /* ignore drain errors */
                        }
                    }
                }
                catch (err) {
                    lastErr = err;
                    lastResp = undefined;
                }
            }
            if (lastErr !== undefined) {
                throw lastErr;
            }
            // All attempts returned a retriable status. Surface the last
            // response so the caller can decide what to log.
            return lastResp;
        };
    }
    computeDelay(prev, retryCount) {
        if (prev) {
            const hint = parseRetryAfter(prev.headers.get('Retry-After'), this.clock());
            if (hint !== undefined) {
                return Math.min(hint, this.maxDelayMs);
            }
        }
        let d = this.baseDelayMs;
        for (let i = 1; i < retryCount; i++) {
            d *= 2;
            if (d >= this.maxDelayMs)
                return this.maxDelayMs;
        }
        return d;
    }
}
function shouldRetry(status) {
    return status === 429 || (status >= 500 && status < 600);
}
/**
 * Parses an RFC 9110 Retry-After header. Returns ms, or undefined when
 * the header is absent / malformed so the caller falls back to
 * exponential backoff.
 */
export function parseRetryAfter(raw, nowMs) {
    if (!raw)
        return undefined;
    const trimmed = raw.trim();
    if (/^[0-9]+$/.test(trimmed)) {
        return Number.parseInt(trimmed, 10) * 1000;
    }
    // Numeric forms that don't match the unsigned-int regex (signed,
    // float, hex) are rejected outright. Date.parse is permissive
    // enough to accept '-5' as a year-only date in some runtimes; we
    // never want to confuse that with a Retry-After hint.
    if (/^[+-]?[0-9]/.test(trimmed))
        return undefined;
    const t = Date.parse(trimmed);
    if (!Number.isNaN(t)) {
        const delta = t - nowMs;
        return delta > 0 ? delta : undefined;
    }
    return undefined;
}
//# sourceMappingURL=retry.js.map