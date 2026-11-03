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
import { type Clock } from "../core/index.js";
import { type AuthContext } from "./auth.js";
import { type RequestSigner } from "./requestSigner.js";
import { type Transport } from "./transport.js";
/** Production account service — source of the session-bootstrap endpoint. */
export declare const DEFAULT_ACCOUNT_BASE_URL = "https://account.isaapi.com";
/** Constructor inputs for {@link sessionSigner}. */
export interface SessionSignerOptions {
    /** BPP keycode. Required by the bootstrap wire contract. */
    readonly keycode: string;
    /** Live identity: email, licenseKey (HMAC bootstrap key), deviceId. */
    readonly auth: AuthContext;
    /** HTTP facade for the bootstrap call. Reuses the product transport. */
    readonly transport: Transport;
    /** Injectable clock; defaults to the system clock. */
    readonly clock?: Clock;
    /** Account-service origin override; defaults to {@link DEFAULT_ACCOUNT_BASE_URL}. */
    readonly accountBaseUrl?: string;
}
/**
 * Build a `RequestSigner` that transparently bootstraps and renews a
 * session, signing every request with it. Concurrent callers during a
 * bootstrap/renewal share the same in-flight request rather than each
 * minting their own session.
 */
export declare function sessionSigner(opts: SessionSignerOptions): RequestSigner;
//# sourceMappingURL=sessionSigner.d.ts.map