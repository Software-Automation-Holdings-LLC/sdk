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
import { fromHttpResponse, RapidSignError } from "./errors.js";
/** Path prefixes (a single source of truth for routing). */
const PATH = {
    voiceCode: (signId) => `/v1/documents/${encodeURIComponent(signId)}/voice-code`,
};
/** Public service object exposed as `isa.rapidsign.voice`. */
export class VoiceService {
    ctx;
    constructor(ctx) {
        this.ctx = ctx;
    }
    /**
     * Mint a single-use voice-sign application code bound to `signId` and
     * notify nobody — the caller is responsible for delivering the code to
     * the signer through its own channel. The signer dials the ceremony's
     * universal number and enters the code to begin the call; once the call
     * completes, drive the rest of the lifecycle the same way as any other
     * ceremony: `documents.awaitSignature` (or `documents.get`) for the
     * signature, `documents.download` for the PDF.
     */
    async mintCode(signId, request) {
        requireSignId(signId);
        validateMintCodeRequest(request);
        const body = {
            session_id: request.sessionId,
            secret_key: request.secretKey,
            form: request.form,
            signer: request.signer,
            ...(request.script !== undefined && { voice_script: toWireScript(request.script) }),
        };
        const payload = await this.callJSON(PATH.voiceCode(signId), body);
        if (!payload.code) {
            throw new RapidSignError.Unknown(`voice.mintCode: server response missing code (sign_id=${signId})`, { httpStatus: 200, requestId: "" });
        }
        if (payload.expires_at === undefined) {
            // A `0` fallback here would produce an already-expired (1970) Date,
            // silently discarding an otherwise-valid code (see `code` check above
            // for the same "malformed 2xx" contract).
            throw new RapidSignError.Unknown(`voice.mintCode: server response missing expires_at (sign_id=${signId})`, { httpStatus: 200, requestId: "" });
        }
        // The caller-supplied signId is already validated non-empty above and
        // addressed the request (it's in the URL path). payload.sign_id is the
        // server's echo of it. When the server includes it, cross-check rather
        // than silently trust the caller's copy — a mismatch means the response
        // landed against the wrong document. Mirrors the Go client's identical
        // check (packages/go/rapidsign/voice.go).
        if (payload.sign_id !== undefined && payload.sign_id !== signId) {
            throw new RapidSignError.Unknown(`voice.mintCode: server echoed sign_id "${payload.sign_id}" for request to sign_id "${signId}"`, { httpStatus: 200, requestId: "" });
        }
        return {
            signId,
            code: payload.code,
            expiresAt: new Date(payload.expires_at * 1_000),
        };
    }
    /** Authorization + UA + JSON content-type, mirroring `DocumentsService`. */
    headers(idempotencyKey) {
        return {
            Authorization: `Bearer ${this.ctx.token}`,
            "User-Agent": this.ctx.userAgent,
            Accept: "application/json, application/problem+json",
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
        };
    }
    /**
     * POST a JSON body and decode a JSON response. Retries transient 5xx/429
     * errors (bounded by `maxRetries`), mirroring `DocumentsService`'s
     * `callJSON`. The idempotency key is minted once and reused across every
     * retry of this call — a fresh key per attempt would let a retried mint
     * (server received the first attempt but the client never saw the reply)
     * create a second, orphaned voice code for the same sign_id.
     */
    async callJSON(path, body) {
        const serialized = JSON.stringify(body);
        const idempotencyKey = this.ctx.uuid();
        let attempt = 0;
        while (true) {
            const response = await this.ctx.transport({
                url: `${this.ctx.baseUrl}${path}`,
                method: "POST",
                headers: this.headers(idempotencyKey),
                body: serialized,
            });
            if (response.status >= 200 && response.status < 300) {
                return parseMintCodeResponseBody(response.body);
            }
            const err = fromHttpResponse(response.status, response.body, response.headers);
            if (!err.retryable || attempt >= this.ctx.maxRetries) {
                throw err;
            }
            const delay = err.retryAfterMs ?? backoffMs(attempt, this.ctx.uuid);
            await this.ctx.sleeper(delay);
            attempt += 1;
        }
    }
}
function toWireScript(script) {
    return {
        ...(script.disclosureText !== undefined && { disclosure_text: script.disclosureText }),
        steps: script.steps.map((step) => ({
            kind: step.kind,
            ...(step.text !== undefined && { text: step.text }),
            ...(step.audioUrl !== undefined && { audio_url: step.audioUrl }),
        })),
        ...(script.expectedSignerName !== undefined && { expected_signer_name: script.expectedSignerName }),
    };
}
function requireSignId(signId) {
    if (typeof signId !== "string" || signId.length === 0) {
        throw new RapidSignError.ValidationError("signId is required", {
            httpStatus: 400,
            requestId: "",
            param: "signId",
        });
    }
}
function validateMintCodeRequest(request) {
    if (!request) {
        throw new RapidSignError.ValidationError("voice.mintCode: request is required", {
            httpStatus: 400,
            requestId: "",
        });
    }
    requireNonEmpty(request.sessionId, "sessionId");
    requireNonEmpty(request.secretKey, "secretKey");
    requireNonEmpty(request.form, "form");
    requireNonEmpty(request.signer, "signer");
}
function requireNonEmpty(value, param) {
    if (typeof value !== "string" || value.length === 0) {
        throw new RapidSignError.ValidationError(`voice.mintCode: ${param} is required`, {
            httpStatus: 400,
            requestId: "",
            param,
        });
    }
}
/**
 * Parse a mint-code response body field-by-field rather than trusting a
 * blind cast, so a malformed or unexpectedly-shaped server payload yields
 * an empty (falsy) result — routed by the caller into the "missing code"
 * error — instead of a value that lies about its own shape.
 */
function parseMintCodeResponseBody(body) {
    if (!body)
        return {};
    let parsed;
    try {
        parsed = JSON.parse(body);
    }
    catch {
        return {};
    }
    if (parsed === null || typeof parsed !== "object")
        return {};
    const record = parsed;
    return {
        ...(typeof record.sign_id === "string" && { sign_id: record.sign_id }),
        ...(typeof record.code === "string" && { code: record.code }),
        ...(typeof record.expires_at === "number" && { expires_at: record.expires_at }),
    };
}
/** First-retry backoff (jittered), mirroring `DocumentsService`. */
function backoffMs(attempt, uuid) {
    const target = Math.min(500 * 2 ** attempt, 8_000);
    const id = uuid();
    const hex = id.replace(/-/g, "").slice(0, 2);
    const v = Number.parseInt(hex, 16) / 255; // [0, 1]
    const jitter = 0.25;
    const offset = (v * 2 - 1) * jitter;
    return Math.floor(target * (1 + offset));
}
//# sourceMappingURL=voice.js.map