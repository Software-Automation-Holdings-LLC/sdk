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

import { buildLicenseHMACHeaders, type Clock, signRequest, systemClock } from "../core/index.js";
import { type AuthContext } from "./auth.js";

/** Inputs a signer needs to bind auth headers to a specific request. */
export interface SignableRequest {
  /** HTTP method (`POST`, `GET`, …). */
  readonly method: string;
  /** Request path including query string (e.g. `/v3/datasets?x=1`). */
  readonly path: string;
  /** Raw request body string; empty string for body-less verbs. */
  readonly body: string;
}

/**
 * Produces the auth headers for one request. Implementations own a single
 * auth mode; the operation layer never inspects which one.
 */
export interface RequestSigner {
  /** Return the auth headers binding this signer's credential to the request. */
  signHeaders(request: SignableRequest): Promise<Record<string, string>>;
}

/**
 * License-HMAC signer. Wraps {@link buildLicenseHMACHeaders}, binding the
 * `(licenseKey, orderId, email, deviceId)` identity to each request via
 * HMAC-SHA256 over the body. This is the BPP agent path; behavior is
 * byte-identical to the pre-signer inline call so the live `bpp2.0`
 * consumer is unaffected.
 */
export function licenseSigner(auth: AuthContext, clock: Clock = systemClock): RequestSigner {
  return {
    async signHeaders(request: SignableRequest): Promise<Record<string, string>> {
      return {
        ...(await buildLicenseHMACHeaders(
          auth.licenseKey,
          auth.orderId,
          auth.email,
          request.method,
          request.path,
          request.body,
          auth.deviceId,
          clock,
        )),
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
export function bearerSigner(token: string): RequestSigner {
  const trimmed = token.trim();
  if (trimmed === "") {
    throw new Error("requestSigner: bearer signer refuses an empty token");
  }
  const header = `Bearer ${trimmed}`;
  return {
    async signHeaders(): Promise<Record<string, string>> {
      return { Authorization: header };
    },
  };
}

/**
 * Fixed-session signer. Signs each request with an already-minted session —
 * the credential an embedded app is handed once its launch code is redeemed.
 * Unlike {@link sessionSigner} it never bootstraps or renews: the session is
 * the caller's whole identity, so when it expires the server refuses the
 * request and the host decides how to re-authenticate.
 */
export function sessionCredentialSigner(session: { sessionId: string; sessionSecret: string }): RequestSigner {
  return {
    async signHeaders(request: SignableRequest): Promise<Record<string, string>> {
      const { headers } = await signRequest({
        method: request.method,
        path: request.path,
        body: request.body,
        sessionId: session.sessionId,
        sessionSecret: session.sessionSecret,
      });
      // The verifier's replay cache is keyed on (sessionId, X-Isa-Request-Id):
      // without a fresh id per call every request after the first is rejected.
      return { ...headers, "X-Isa-Request-Id": globalThis.crypto.randomUUID() };
    },
  };
}
