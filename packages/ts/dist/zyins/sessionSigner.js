/**
 * Session-bootstrap `RequestSigner` — the default signer for
 * `Isa.withKeycode()` callers, replacing License-HMAC
 * (`Authorization: License base64(...)`) as the credential that actually
 * travels on the wire.
 *
 * On first use (or when the cached session is within
 * {@link SESSION_RENEWAL_MARGIN_MS} of expiry) the signer bootstraps a
 * fresh session at `POST /v1/sessions` on the account service —
 * HMAC-signed with the license key per `core/internal/auth/bootstrap.ts`
 * — then signs every subsequent request with the returned session secret
 * (`core/auth/signRequest.ts`). The license key itself appears on the
 * wire only for that one bootstrap call; every product call after it
 * carries a short-lived session credential instead.
 *
 * Re-issue is the same endpoint as bootstrap: calling `POST /v1/sessions`
 * again for the same (keycode, email, deviceId) rotates the secret
 * server-side, keeping the previous secret valid for a 30-second grace
 * overlap (see `sessions_bootstrap.go`). Renewing proactively — well
 * before expiry, not at it — means an in-flight request signed with the
 * about-to-rotate secret always lands inside that grace window.
 */
import { buildBootstrapSignatureAsync, signRequest, systemClock } from "../core/index.js";
import { IsaNotActivatedError } from "./apiError.js";
import { fromHttpResponse } from "./errors.js";
/** Production account service — source of the session-bootstrap endpoint. */
export const DEFAULT_ACCOUNT_BASE_URL = "https://account.isaapi.com";
/** Wire path for both bootstrap and re-issue (same endpoint, see module doc). */
const SESSIONS_PATH = "/v1/sessions";
/**
 * Renew this long before expiry so no in-flight request can race a
 * stale session past the server's 30-second rotation grace window. Five
 * minutes comfortably covers clock skew, network latency, and retries.
 */
const SESSION_RENEWAL_MARGIN_MS = 5 * 60 * 1000;
/**
 * Build a `RequestSigner` that transparently bootstraps and renews a
 * session, signing every request with it. Concurrent callers during a
 * bootstrap/renewal share the same in-flight request rather than each
 * minting their own session.
 */
export function sessionSigner(opts) {
    const clock = opts.clock ?? systemClock;
    let current;
    let inFlight;
    async function ensureSession() {
        if (current && current.expiresAtMs - clock() > SESSION_RENEWAL_MARGIN_MS) {
            return current;
        }
        if (!inFlight) {
            inFlight = bootstrapSession(opts, clock).finally(() => {
                inFlight = undefined;
            });
        }
        current = await inFlight;
        return current;
    }
    return {
        async signHeaders(request) {
            const session = await ensureSession();
            const { headers } = await signRequest({
                method: request.method,
                path: request.path,
                body: request.body,
                sessionId: session.sessionId,
                sessionSecret: session.sessionSecret,
            });
            // The session's device binding (shared/go/auth/session verifier)
            // rejects a signature-valid request whose X-Device-ID doesn't match
            // the deviceId the session was bootstrapped under.
            return { ...headers, "X-Device-ID": opts.auth.deviceId };
        },
    };
}
/** Mint (or rotate) a session via the account service's HMAC bootstrap call. */
async function bootstrapSession(opts, clock) {
    // The bootstrap HMAC key IS the license key (see core/internal/auth/
    // bootstrap.ts). An empty key means the device was never activated —
    // fail with the SDK's own typed error rather than letting SubtleCrypto
    // reject an empty-length HMAC key with an opaque DOMException.
    if (!opts.auth.licenseKey.trim()) {
        throw new IsaNotActivatedError("requires_activation");
    }
    const timestampSeconds = Math.floor(clock() / 1000);
    const { serializedBody, hex } = await buildBootstrapSignatureAsync({
        keycode: opts.keycode,
        email: opts.auth.email,
        licenseKey: opts.auth.licenseKey,
        deviceId: opts.auth.deviceId,
        method: "POST",
        path: SESSIONS_PATH,
        timestamp: timestampSeconds,
    });
    const baseUrl = opts.accountBaseUrl ?? DEFAULT_ACCOUNT_BASE_URL;
    const response = await opts.transport({
        url: `${baseUrl}${SESSIONS_PATH}`,
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            // Value form only ("t=<ts>,v1=<hex>") — the header NAME goes in the
            // headers map key, never duplicated into the value itself.
            "ISA-Signature": `t=${timestampSeconds},v1=${hex}`,
        },
        body: serializedBody,
    });
    if (response.status < 200 || response.status >= 300) {
        throw fromHttpResponse(response.status, response.body);
    }
    return parseBootstrapResponse(response.body);
}
/**
 * Parse the `POST /v1/sessions` envelope into a {@link SessionState}.
 * Same endpoint `Isa.forForm`'s `parseSessionMintResponse` reads (see
 * `isa.ts`) — mirrors its envelope-or-bare-object and camelCase-or-
 * snake_case tolerance so both callers degrade the same way if the
 * response shape ever drifts.
 */
function parseBootstrapResponse(body) {
    let parsed;
    try {
        parsed = JSON.parse(body);
    }
    catch {
        throw new Error(`sessionSigner: ${SESSIONS_PATH} returned non-JSON body`);
    }
    const data = parsed.data ?? parsed;
    const record = data;
    const sessionId = record.sessionId ?? record.session_id;
    const sessionSecret = record.sessionSecret ?? record.session_secret;
    const expiresAt = record.expiresAt ?? record.expires_at;
    if (typeof sessionId !== "string" || typeof sessionSecret !== "string" || typeof expiresAt !== "string") {
        throw new Error(`sessionSigner: ${SESSIONS_PATH} response missing sessionId/sessionSecret/expiresAt`);
    }
    const expiresAtMs = Date.parse(expiresAt);
    if (Number.isNaN(expiresAtMs)) {
        throw new Error(`sessionSigner: ${SESSIONS_PATH} returned an unparseable expiresAt: ${expiresAt}`);
    }
    return { sessionId, sessionSecret, expiresAtMs };
}
//# sourceMappingURL=sessionSigner.js.map