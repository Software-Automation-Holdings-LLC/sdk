/**
 * Unit tests for `sessionSigner` — the default `RequestSigner` behind
 * `Isa.withKeycode()`, which transparently bootstraps and renews a
 * session instead of sending the legacy `Authorization: License
 * base64(...)` header on every request.
 *
 * Covers, against an in-memory transport (no network):
 *  - First call bootstraps a session and signs with it; the license key
 *    never appears in the product-request headers.
 *  - A second call within the session's lifetime reuses the cached
 *    session — no second bootstrap request.
 *  - A cached session inside the renewal margin of expiry is proactively
 *    re-bootstrapped rather than used past the margin.
 *  - Concurrent signers share one in-flight bootstrap rather than each
 *    minting their own session.
 *  - An unactivated device (empty licenseKey) fails locally with
 *    `IsaNotActivatedError` — no network call, no opaque crypto error.
 *  - A bootstrap failure (e.g. 401) surfaces as a typed `IsaApiError`.
 */
import { describe, expect, it } from "vitest";
import { IsaApiError, IsaNotActivatedError } from "../../src/zyins/apiError";
import { DEFAULT_ACCOUNT_BASE_URL, sessionSigner } from "../../src/zyins/sessionSigner";
import type { Transport, TransportRequest } from "../../src/zyins/transport";
import { TEST_AUTH } from "./fixtures";

const SESSIONS_PATH = "/v1/sessions";

/** Deterministic manual clock: starts at `startMs`, advances only when told to. */
function manualClock(startMs: number): { now: () => number; advance: (ms: number) => void } {
  let current = startMs;
  return {
    now: () => current,
    advance: (ms: number) => {
      current += ms;
    },
  };
}

function sessionEnvelope(sessionId: string, sessionSecret: string, expiresAt: string): string {
  return JSON.stringify({ data: { sessionId, sessionSecret, expiresAt } });
}

/** Records every request and answers bootstrap calls with a fresh session id per call. */
function bootstrapCountingTransport(expiresAt: string): {
  transport: Transport;
  requests: TransportRequest[];
  bootstrapCount: () => number;
} {
  const requests: TransportRequest[] = [];
  let bootstraps = 0;
  const transport: Transport = async (request) => {
    requests.push(request);
    if (request.method === "POST" && request.url.endsWith(SESSIONS_PATH)) {
      bootstraps += 1;
      return {
        status: 201,
        body: sessionEnvelope(`sess_${bootstraps}`, `sk_sess_${bootstraps}`, expiresAt),
        headers: {},
      };
    }
    return { status: 200, body: "{}", headers: {} };
  };
  return { transport, requests, bootstrapCount: () => bootstraps };
}

describe("sessionSigner", () => {
  it("bootstraps a session on first use and signs with it, never the license key", async () => {
    const clock = manualClock(1_700_000_000_000);
    const { transport, requests } = bootstrapCountingTransport("2999-01-01T00:00:00Z");
    const signer = sessionSigner({
      keycode: "SDV-HWH-WDD",
      auth: TEST_AUTH,
      transport,
      clock: clock.now,
    });

    const headers = await signer.signHeaders({ method: "GET", path: "/v3/datasets", body: "" });

    // signHeaders only performs the bootstrap call; the product request
    // itself is issued separately by the caller (e.g. prequalify-v3).
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe(`${DEFAULT_ACCOUNT_BASE_URL}${SESSIONS_PATH}`);
    expect(headers["Authorization"]).toBe("Session sk_sess_1");
    expect(headers["X-Isa-Session-Id"]).toBe("sess_1");
    expect(headers["X-Device-ID"]).toBe(TEST_AUTH.deviceId);
    expect(typeof headers["X-Isa-Signature"]).toBe("string");
    // The license key is the bootstrap HMAC key, never a header value.
    for (const value of Object.values(headers)) {
      expect(value).not.toContain(TEST_AUTH.licenseKey);
    }
  });

  it("reuses the cached session for a second call — no second bootstrap", async () => {
    const clock = manualClock(1_700_000_000_000);
    const { transport, bootstrapCount } = bootstrapCountingTransport("2999-01-01T00:00:00Z");
    const signer = sessionSigner({
      keycode: "SDV-HWH-WDD",
      auth: TEST_AUTH,
      transport,
      clock: clock.now,
    });

    await signer.signHeaders({ method: "GET", path: "/v3/datasets", body: "" });
    await signer.signHeaders({ method: "POST", path: "/v3/prequalify", body: "{}" });

    expect(bootstrapCount()).toBe(1);
  });

  it("renews proactively once the cached session enters the renewal margin", async () => {
    const clock = manualClock(1_700_000_000_000);
    // Expires 4 minutes from "now" — inside the 5-minute renewal margin.
    const soonExpiry = new Date(1_700_000_000_000 + 4 * 60 * 1000).toISOString();
    const { transport, bootstrapCount } = bootstrapCountingTransport(soonExpiry);
    const signer = sessionSigner({
      keycode: "SDV-HWH-WDD",
      auth: TEST_AUTH,
      transport,
      clock: clock.now,
    });

    await signer.signHeaders({ method: "GET", path: "/v3/datasets", body: "" });
    expect(bootstrapCount()).toBe(1);

    // Second call, same instant: the cached session is already inside the
    // renewal margin, so it must renew again rather than reuse it.
    await signer.signHeaders({ method: "GET", path: "/v3/datasets", body: "" });
    expect(bootstrapCount()).toBe(2);
  });

  it("shares one in-flight bootstrap across concurrent callers", async () => {
    const clock = manualClock(1_700_000_000_000);
    const { transport, bootstrapCount } = bootstrapCountingTransport("2999-01-01T00:00:00Z");
    const signer = sessionSigner({
      keycode: "SDV-HWH-WDD",
      auth: TEST_AUTH,
      transport,
      clock: clock.now,
    });

    const [a, b] = await Promise.all([
      signer.signHeaders({ method: "GET", path: "/v3/datasets", body: "" }),
      signer.signHeaders({ method: "GET", path: "/v3/datasets", body: "" }),
    ]);

    expect(bootstrapCount()).toBe(1);
    expect(a["X-Isa-Session-Id"]).toBe(b["X-Isa-Session-Id"]);
  });

  it("fails locally with IsaNotActivatedError for an empty license key — no network call", async () => {
    const { transport, requests } = bootstrapCountingTransport("2999-01-01T00:00:00Z");
    const signer = sessionSigner({
      keycode: "SDV-HWH-WDD",
      auth: { ...TEST_AUTH, licenseKey: "" },
      transport,
    });

    await expect(
      signer.signHeaders({ method: "GET", path: "/v3/datasets", body: "" }),
    ).rejects.toBeInstanceOf(IsaNotActivatedError);
    expect(requests).toHaveLength(0);
  });

  it("surfaces a bootstrap HTTP failure as a typed IsaApiError", async () => {
    const failingTransport: Transport = async () => ({
      status: 401,
      body: JSON.stringify({
        type: "https://isaapi.com/errors/bootstrap-signature",
        title: "Bootstrap signature invalid",
        status: 401,
        code: "bootstrap_signature_invalid",
        detail: "signature verification failed",
      }),
      headers: {},
    });
    const signer = sessionSigner({
      keycode: "SDV-HWH-WDD",
      auth: TEST_AUTH,
      transport: failingTransport,
    });

    await expect(
      signer.signHeaders({ method: "GET", path: "/v3/datasets", body: "" }),
    ).rejects.toBeInstanceOf(IsaApiError);
  });

  it("tolerates a snake_case bootstrap response, mirroring Isa.forForm", async () => {
    const snakeCaseTransport: Transport = async () => ({
      status: 201,
      body: JSON.stringify({
        data: {
          session_id: "sess_snake",
          session_secret: "sk_sess_snake",
          expires_at: "2999-01-01T00:00:00Z",
        },
      }),
      headers: {},
    });
    const signer = sessionSigner({ keycode: "SDV-HWH-WDD", auth: TEST_AUTH, transport: snakeCaseTransport });

    const headers = await signer.signHeaders({ method: "GET", path: "/v3/datasets", body: "" });

    expect(headers["Authorization"]).toBe("Session sk_sess_snake");
    expect(headers["X-Isa-Session-Id"]).toBe("sess_snake");
  });

  it("tolerates a bare (non-enveloped) bootstrap response body", async () => {
    const bareTransport: Transport = async () => ({
      status: 201,
      body: JSON.stringify({
        sessionId: "sess_bare",
        sessionSecret: "sk_sess_bare",
        expiresAt: "2999-01-01T00:00:00Z",
      }),
      headers: {},
    });
    const signer = sessionSigner({ keycode: "SDV-HWH-WDD", auth: TEST_AUTH, transport: bareTransport });

    const headers = await signer.signHeaders({ method: "GET", path: "/v3/datasets", body: "" });

    expect(headers["X-Isa-Session-Id"]).toBe("sess_bare");
  });

  it("posts the bootstrap call to accountBaseUrl when overridden", async () => {
    const { transport, requests } = bootstrapCountingTransport("2999-01-01T00:00:00Z");
    const signer = sessionSigner({
      keycode: "SDV-HWH-WDD",
      auth: TEST_AUTH,
      transport,
      accountBaseUrl: "http://localhost:9999",
    });

    await signer.signHeaders({ method: "GET", path: "/v3/datasets", body: "" });

    expect(requests[0]?.url).toBe(`http://localhost:9999${SESSIONS_PATH}`);
  });
});
