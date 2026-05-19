import { type Clock } from '../../core';
export type EmbeddedAlgosureHeaders = {
    'Authorization': string;
    '*Host': string;
    '*Timestamp': string;
    '*sessionId': string;
    '*SaltId': string;
};
export interface EmbeddedAlgosureArgs {
    /** Embedded salt content (form.metadata._algosure_salt). */
    salt: string;
    /** Embedded platform salt id (form.metadata._algosure_salt_id). */
    saltId: number | string;
    /** The *Host value (customer-scoped form host). */
    host: string;
    /** HTTP method. */
    method: string;
    /** Request path. */
    path: string;
    /** Request body — string passes through; objects are JSON-stringified. */
    body?: string | object | null;
    /** Session identifier (*sessionId). */
    sessionId: string;
    /** Explicit timestamp in ms; overrides the clock. */
    time?: number;
    /** Injectable clock facade; defaults to systemClock. */
    clock?: Clock;
    /** Injectable SubtleCrypto; defaults to globalThis.crypto.subtle. */
    subtle?: SubtleCrypto;
}
/**
 * Returns true when `saltId` round-trips cleanly to the proxy verifier's
 * positive-integer parse. Rejecting here surfaces a malformed embed at
 * the signer rather than as an opaque 4xx downstream.
 */
export declare function isEmbeddedSaltIdValid(saltId: unknown): boolean;
/**
 * Computes [hmacTag, timestampUsed] for an Algosure-authenticated request,
 * using a caller-supplied embedded salt. No runtime fetch occurs.
 */
export declare function computeEmbeddedAlgosureHMAC(args: EmbeddedAlgosureArgs): Promise<[string, number]>;
/**
 * Builds the full embedded-Algosure header bag. The emitted *SaltId tells
 * the verifier which proxy_salts row the form was built against, decoupling
 * salt rotation from deployed-form lifetime.
 *
 * Use the bucket-aligned 30s window: client and server agree on the bucket
 * regardless of minor clock skew; the verifier still enforces ±30s drift.
 */
export declare function buildEmbeddedAlgosureHeaders(args: EmbeddedAlgosureArgs): Promise<EmbeddedAlgosureHeaders>;
export { ALGOSURE_TIME_BUCKET_MS } from './hmac';
//# sourceMappingURL=embedded.d.ts.map