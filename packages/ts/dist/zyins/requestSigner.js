/**
 * Per-request auth-header strategy for the Tier 3 ZyINS surface.
 *
 * The ZyINS engine honors two interchangeable auth modes on `/v3`
 * (verified live across all five SDKs): License-HMAC (BPP agents) and
 * server-to-server bearer tokens (API-licensing customers). Both reach the
 * same quoting/reference/datasets endpoints; the only difference is the
 * headers attached to each request.
 *
 * A `RequestSigner` names that difference. It is the TS analogue of the C#
 * `IRequestSigner` / `BearerTokenRequestSigner` pair (see PR #454): the
 * operation builds method/path/body, hands them to the signer, and the
 * signer returns the auth headers — never the reverse. Operations stay
 * auth-mode-agnostic; adding a third mode is a new signer, not a new branch
 * in every call site.
 */
import { buildLicenseHMACHeaders, systemClock } from '../core/index.js';
/**
 * License-HMAC signer. Wraps {@link buildLicenseHMACHeaders}, binding the
 * `(licenseKey, orderId, email, deviceId)` identity to each request via
 * HMAC-SHA256 over the body. This is the BPP agent path; behavior is
 * byte-identical to the pre-signer inline call so the live `bpp2.0`
 * consumer is unaffected.
 */
export function licenseSigner(auth, clock = systemClock) {
    return {
        async signHeaders(request) {
            return {
                ...(await buildLicenseHMACHeaders(auth.licenseKey, auth.orderId, auth.email, request.method, request.path, request.body, auth.deviceId, clock)),
            };
        },
    };
}
/**
 * Bearer-token signer. Attaches `Authorization: Bearer <token>` — the
 * server-to-server credential mode the API-licensing customer authenticates
 * with. The token is opaque to the SDK; the engine resolves scope and
 * test/live mode from it.
 */
export function bearerSigner(token) {
    const trimmed = token.trim();
    if (trimmed === '') {
        throw new Error('requestSigner: bearer signer refuses an empty token');
    }
    const header = `Bearer ${trimmed}`;
    return {
        async signHeaders() {
            return { Authorization: header };
        },
    };
}
//# sourceMappingURL=requestSigner.js.map