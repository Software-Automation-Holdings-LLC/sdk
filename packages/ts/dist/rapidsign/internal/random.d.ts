/**
 * UUID + clock + sleep facades.
 *
 * Production code routes time, randomness, and delays through injectable
 * facades defined here. `DocumentsService` receives `clock` and `sleeper`
 * from `RapidSignClient`; error parsing uses `systemClock` for Retry-After.
 */
/** Pluggable UUIDv4 generator. */
export type UUIDGenerator = () => string;
/** Default UUIDv4 generator backed by Node's `crypto.randomUUID`. */
export declare const defaultUUIDGenerator: UUIDGenerator;
/** Pluggable monotonic clock returning epoch-milliseconds. */
export type Clock = () => number;
/** Default clock reads the system time. */
export declare const systemClock: Clock;
/** Pluggable sleep facade returning a promise that resolves after `ms`. */
export type Sleeper = (ms: number, signal?: AbortSignal) => Promise<void>;
/**
 * Default sleeper uses `setTimeout` and listens to `signal` for abort.
 * Abort during sleep rejects with an `Error` named `AbortError` (or
 * `signal.reason` when present) so callers can handle cancellation uniformly.
 */
export declare const defaultSleeper: Sleeper;
//# sourceMappingURL=random.d.ts.map