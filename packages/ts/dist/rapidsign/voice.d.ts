/**
 * RapidSign voice-signing service.
 *
 * A voice ceremony resolves to the same signing envelope every other
 * ceremony type produces (SAH-4608): once the signer completes the phone
 * call, the resulting signature and PDF are fetched exactly as for any
 * other sign id, via `documents.get` / `documents.awaitSignature` /
 * `documents.download`. Voice adds exactly one new step ahead of that
 * shared lifecycle — minting the single-use code the signer dials in
 * with.
 *
 * Wire-mirrors the Go client's `Voice` (packages/go/rapidsign/voice.go).
 */
import { type DocumentsContext } from "./documents.js";
import { type MintCodeRequest, type VoiceCode } from "./types.js";
/** Public service object exposed as `isa.rapidsign.voice`. */
export declare class VoiceService {
    private readonly ctx;
    constructor(ctx: DocumentsContext);
    /**
     * Mint a single-use voice-sign application code bound to `signId` and
     * notify nobody — the caller is responsible for delivering the code to
     * the signer through its own channel. The signer dials the ceremony's
     * universal number and enters the code to begin the call; once the call
     * completes, drive the rest of the lifecycle the same way as any other
     * ceremony: `documents.awaitSignature` (or `documents.get`) for the
     * signature, `documents.download` for the PDF.
     */
    mintCode(signId: string, request: MintCodeRequest): Promise<VoiceCode>;
    /** Authorization + UA + JSON content-type, mirroring `DocumentsService`. */
    private headers;
    /**
     * POST a JSON body and decode a JSON response. Retries transient 5xx/429
     * errors (bounded by `maxRetries`), mirroring `DocumentsService`'s
     * `callJSON`. The idempotency key is minted once and reused across every
     * retry of this call — a fresh key per attempt would let a retried mint
     * (server received the first attempt but the client never saw the reply)
     * create a second, orphaned voice code for the same sign_id.
     */
    private callJSON;
}
//# sourceMappingURL=voice.d.ts.map