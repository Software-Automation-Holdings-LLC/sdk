/**
 * RapidSign documents service.
 *
 * Five public methods on the SDK surface:
 *
 *   - `send`             — create + notify (one logical op; two server calls today)
 *   - `get`              — read current state
 *   - `awaitSignature`   — poll until signed or timeout
 *   - `download`         — fetch the signed PDF (transparently decompressed)
 *   - `cancel`           — cancel a pending envelope (server endpoint pending, #38)
 *
 * Two of these methods are "shape leads server": `send` collapses a
 * `CreateDocument` + `NotifyDocument` pair the proto exposes separately, and
 * `cancel` throws `NotImplemented` until the matching server endpoint ships
 * (tracked in issue #38). The SDK surface is the product.
 */
import { type AwaitOpts, type CancelRequest, type Envelope, type SendRequest, type Signature } from './types.js';
import { type Transport } from './internal/transport.js';
import { type Decompressor } from './internal/decompress.js';
import { type Clock, type Sleeper, type UUIDGenerator } from './internal/random.js';
/** Per-call context the parent client injects. */
export interface DocumentsContext {
    readonly token: string;
    readonly baseUrl: string;
    readonly userAgent: string;
    readonly transport: Transport;
    readonly clock: Clock;
    readonly sleeper: Sleeper;
    readonly uuid: UUIDGenerator;
    readonly decompressor: Decompressor;
    readonly maxRetries: number;
}
/** Public service object exposed as `isa.rapidsign.documents`. */
export declare class DocumentsService {
    private readonly ctx;
    constructor(ctx: DocumentsContext);
    /**
     * Send a packet to a recipient. Issues a `CreateDocument` then
     * `NotifyDocument`; both fail-safely (a failed notify after a successful
     * create surfaces as the underlying error, leaving the packet retrievable
     * by sign id for a retry).
     */
    send(request: SendRequest): Promise<Envelope>;
    /**
     * Fetch current state for a signed-or-pending envelope. Returns a
     * Signature when the document has been signed; throws `NotFound` when
     * the sign id is unknown or no signature has been captured yet.
     */
    get(signId: string, sessionId?: string, signal?: AbortSignal): Promise<Signature>;
    /**
     * Poll `get` on a jittered exponential backoff until the document is
     * signed, the AbortSignal fires, or the timeout elapses.
     *
     * On the first `get` 404, probes `download` once: per proto, download
     * 404 means no document was stored for the sign id (invalid id), while
     * get 404 alone means the signature is not captured yet.
     */
    awaitSignature(signId: string, opts?: AwaitOpts): Promise<Signature>;
    /**
     * Download the signed PDF as a fresh `Buffer`. The wire response is
     * gzip + base64; decompression is transparent. Throws `NotFound` if the
     * sign id is unknown.
     */
    download(signId: string, sessionId?: string): Promise<Buffer>;
    /**
     * Cancel a pending envelope.
     *
     * The matching server endpoint is not yet implemented (tracked at the
     * issue URL embedded in the thrown error). The SDK surface lands here so
     * the cross-language contract is final; flipping the error to a real call
     * is a one-line change once the server lands.
     */
    cancel(signId: string, request: CancelRequest): Promise<void>;
    /** Authorization + UA + JSON content-type. Per-call extras are merged in. */
    private headers;
    /**
     * JSON-body request helper. Handles retries on 5xx/429 (bounded by
     * `maxRetries`) and surfaces the typed error funnel.
     */
    private callJSON;
    /**
     * Whether the server has a stored document packet for `signId`.
     * Download returns 404 when no document exists (per proto).
     */
    private signIdHasStoredDocument;
}
//# sourceMappingURL=documents.d.ts.map