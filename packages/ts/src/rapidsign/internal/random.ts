/**
 * UUID + clock + sleep facades.
 *
 * Production code routes time, randomness, and delays through injectable
 * facades defined here. `DocumentsService` receives `clock` and `sleeper`
 * from `RapidSignClient`; error parsing uses `systemClock` for Retry-After.
 */

import { randomUUID as nodeRandomUUID } from 'node:crypto';

/** Pluggable UUIDv4 generator. */
export type UUIDGenerator = () => string;

/** Default UUIDv4 generator backed by Node's `crypto.randomUUID`. */
export const defaultUUIDGenerator: UUIDGenerator = () => nodeRandomUUID();

/** Pluggable monotonic clock returning epoch-milliseconds. */
export type Clock = () => number;

/** Default clock reads the system time. */
export const systemClock: Clock = () => Date.now();

/** Pluggable sleep facade returning a promise that resolves after `ms`. */
export type Sleeper = (ms: number, signal?: AbortSignal) => Promise<void>;

/**
 * Default sleeper uses `setTimeout` and listens to `signal` for abort.
 * Abort during sleep rejects with an `Error` named `AbortError` (or
 * `signal.reason` when present) so callers can handle cancellation uniformly.
 */
export const defaultSleeper: Sleeper = (ms, signal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(abortError(signal));

    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onAbort = (): void => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      reject(abortError(signal!));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    if (signal?.aborted) return onAbort();

    timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
  });

function abortError(signal: AbortSignal): Error {
  const reason = (signal as { reason?: unknown }).reason;
  if (reason instanceof Error) return reason;
  const err = new Error('aborted');
  err.name = 'AbortError';
  return err;
}
