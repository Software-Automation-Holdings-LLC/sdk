/*
 * Algosure HMAC — embedded-salt variant (post-PR #512 protocol).
 *
 * This module implements the canonical signer for the embed-with-id
 * deployment model: the form publisher writes {salt, saltId} into form
 * metadata at save time, and the runtime passes both as arguments. No
 * runtime salt fetch occurs.
 *
 * Source of truth: eapp-system/resources/js/lib/algosure-hmac.js on
 * `main` (post-#512) and isa-platform/shared/go/auth/algosure on `main`
 * (post-#106). The cross-language test vectors at
 * shared/schemas/sdk/testdata/algosure_vectors.json are derived from
 * this same algorithm and consumed verbatim by Go + TS parity tests.
 *
 * Header emitted: *SaltId (alongside *Host, *Timestamp, *sessionId,
 * Authorization). The proxy verifier uses *SaltId for exact-match lookup
 * in proxy_salts so deployed forms keep working across rotations.
 *
 * The pre-existing buildAlgosureHeaders / computeAlgosureHMAC in
 * ./hmac.ts retain their runtime-fetch contract for callers that have
 * not yet migrated; new callers should prefer the functions in this
 * module.
 */

import { resolveSubtle, arrayBufferToHex, type Clock, systemClock } from '../../core';
import { ALGOSURE_TIME_BUCKET_MS, deriveSimpleKey } from './hmac';

const CONTEXT = 'Algosure';

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
export function isEmbeddedSaltIdValid(saltId: unknown): boolean {
    if (typeof saltId === 'number') {
        return Number.isInteger(saltId) && saltId > 0;
    }
    return typeof saltId === 'string' && /^[1-9][0-9]*$/.test(saltId);
}

function normalizeSaltIdHeader(saltId: number | string): string {
    if (!isEmbeddedSaltIdValid(saltId)) {
        throw new Error(
            'Algosure: missing or malformed embedded salt id (form.metadata._algosure_salt_id). Republish the form to pick up the salt embed.',
        );
    }
    return typeof saltId === 'number' ? String(saltId) : saltId;
}

function serializeBody(body: EmbeddedAlgosureArgs['body']): string {
    if (body == null) return '';
    return typeof body === 'string' ? body : JSON.stringify(body);
}

async function sha256Hex(data: string, subtle: SubtleCrypto): Promise<string> {
    const enc = new TextEncoder();
    const buf = await subtle.digest('SHA-256', enc.encode(data));
    return arrayBufferToHex(buf);
}

async function hmacSha256Hex(key: string, message: string, subtle: SubtleCrypto): Promise<string> {
    const enc = new TextEncoder();
    const cryptoKey = await subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = await subtle.sign('HMAC', cryptoKey, enc.encode(message));
    return arrayBufferToHex(sig);
}

/**
 * Computes [hmacTag, timestampUsed] for an Algosure-authenticated request,
 * using a caller-supplied embedded salt. No runtime fetch occurs.
 */
export async function computeEmbeddedAlgosureHMAC(args: EmbeddedAlgosureArgs): Promise<[string, number]> {
    if (typeof args.salt !== 'string' || args.salt.length === 0) {
        throw new Error('Algosure: missing embedded salt (form.metadata._algosure_salt). Republish the form to pick up the salt embed.');
    }
    const clock = args.clock ?? systemClock;
    const timestamp = args.time ?? clock();
    const subtle = resolveSubtle(args.subtle, CONTEXT);

    const simpleKey = deriveSimpleKey(args.salt, timestamp);
    const bodyStr = serializeBody(args.body);
    const bodyHash = await sha256Hex(bodyStr, subtle);

    const canonical = [args.method, args.path, bodyHash, String(timestamp), args.sessionId].join('\x00');
    const tag = await hmacSha256Hex(simpleKey, canonical, subtle);
    return [tag, timestamp];
}

/**
 * Builds the full embedded-Algosure header bag. The emitted *SaltId tells
 * the verifier which proxy_salts row the form was built against, decoupling
 * salt rotation from deployed-form lifetime.
 *
 * Use the bucket-aligned 30s window: client and server agree on the bucket
 * regardless of minor clock skew; the verifier still enforces ±30s drift.
 */
export async function buildEmbeddedAlgosureHeaders(args: EmbeddedAlgosureArgs): Promise<EmbeddedAlgosureHeaders> {
    const saltIdHeader = normalizeSaltIdHeader(args.saltId);
    const [tag, timestamp] = await computeEmbeddedAlgosureHMAC(args);
    return {
        Authorization: tag,
        '*Host': args.host,
        '*Timestamp': String(timestamp),
        '*sessionId': args.sessionId,
        '*SaltId': saltIdHeader,
    };
}

export { ALGOSURE_TIME_BUCKET_MS } from './hmac';
