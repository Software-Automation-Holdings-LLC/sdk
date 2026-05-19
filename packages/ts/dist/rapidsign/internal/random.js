/**
 * UUID + clock + sleep facades.
 *
 * Production code routes time, randomness, and delays through injectable
 * facades defined here. `DocumentsService` receives `clock` and `sleeper`
 * from `RapidSignClient`; error parsing uses `systemClock` for Retry-After.
 */
import { randomUUID as nodeRandomUUID } from 'node:crypto';
/** Default UUIDv4 generator backed by Node's `crypto.randomUUID`. */
export const defaultUUIDGenerator = () => nodeRandomUUID();
/** Default clock reads the system time. */
export const systemClock = () => Date.now();
/**
 * Default sleeper uses `setTimeout` and listens to `signal` for abort.
 * Abort during sleep rejects with an `Error` named `AbortError` (or
 * `signal.reason` when present) so callers can handle cancellation uniformly.
 */
export const defaultSleeper = (ms, signal) => new Promise((resolve, reject) => {
    if (signal?.aborted)
        return reject(abortError(signal));
    let settled = false;
    let timer;
    const onAbort = () => {
        if (settled)
            return;
        settled = true;
        if (timer !== undefined)
            clearTimeout(timer);
        reject(abortError(signal));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    if (signal?.aborted)
        return onAbort();
    timer = setTimeout(() => {
        if (settled)
            return;
        settled = true;
        signal?.removeEventListener('abort', onAbort);
        resolve();
    }, ms);
});
function abortError(signal) {
    const reason = signal.reason;
    if (reason instanceof Error)
        return reason;
    const err = new Error('aborted');
    err.name = 'AbortError';
    return err;
}
//# sourceMappingURL=random.js.map