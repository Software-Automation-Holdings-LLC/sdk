/**
 * RapidSign client — the public entrypoint.
 *
 * Construction:
 *
 *   import { RapidSignClient } from '@isa-sdk/rapidsign';
 *   const rapidsign = new RapidSignClient('isa_live_…');
 *   await rapidsign.documents.send({ … });
 *
 * The parent `ISA` umbrella client (in a separate package) wires this in
 * as `isa.rapidsign`. The umbrella's existence is intentionally not
 * mandatory: a curator only using RapidSign can construct this class
 * directly and skip the umbrella entirely.
 */
import { DocumentsService } from './documents';
import { WebhooksService } from './webhooks';
import { type Transport } from './internal/transport';
import { type Decompressor } from './internal/decompress';
import { type Clock, type Sleeper, type UUIDGenerator } from './internal/random';
/** Production RapidSign endpoint. Override only for staging / local. */
export declare const DEFAULT_RAPIDSIGN_BASE_URL = "https://rapidsign.isaapi.com";
/** Default User-Agent string. The version is updated on each release. */
export declare const DEFAULT_USER_AGENT = "@isa-sdk/rapidsign-js/0.0.0";
/** Default retry budget for transient 5xx / 429 errors. */
export declare const DEFAULT_MAX_RETRIES = 2;
/** Construction options for `RapidSignClient`. */
export interface RapidSignClientOptions {
    /** Override the base URL (defaults to production). */
    readonly baseUrl?: string;
    /** Override the User-Agent header. */
    readonly userAgent?: string;
    /** Override the retry budget for transient errors. Set 0 to disable. */
    readonly maxRetries?: number;
    /** Pluggable transport. Defaults to a `fetch`-backed implementation. */
    readonly transport?: Transport;
    /** Pluggable fetch implementation passed into the default transport. */
    readonly fetch?: typeof fetch;
    /** Pluggable clock (testing only). */
    readonly clock?: Clock;
    /** Pluggable sleeper (testing only). */
    readonly sleeper?: Sleeper;
    /** Pluggable UUIDv4 generator (testing only). */
    readonly uuid?: UUIDGenerator;
    /** Pluggable gunzip implementation (testing only). */
    readonly decompressor?: Decompressor;
}
/**
 * The RapidSign client. Construct once per bearer token; methods are
 * grouped under typed sub-clients (`documents`, `webhooks`).
 */
export declare class RapidSignClient {
    readonly documents: DocumentsService;
    readonly webhooks: WebhooksService;
    constructor(token: string, options?: RapidSignClientOptions);
}
//# sourceMappingURL=client.d.ts.map