/**
 * Session auth on the zyins quoting surface (embedded BPP).
 *
 * An embedded app is handed an already-minted session (a launch code the
 * embed host redeemed) and nothing else: no license, no keycode, no device
 * identity. `Isa.create({ auth: SessionAuth.fromSession(...) })` must sign
 * every `/v3` call with exactly that session — HMAC over the canonical
 * string, `Authorization: Session <secret>` — and must never try to
 * bootstrap another one. Asserted against a recording transport (no network).
 */
import { describe, expect, test } from "bun:test";
import { createHash, createHmac } from "node:crypto";
import { Isa, RemoteEngine, SessionAuth } from "../../src/zyins";
import type { Transport, TransportRequest } from "../../src/zyins/transport";
import { TEST_APPLICANT, TEST_COVERAGE, TEST_PRODUCTS, TEST_SESSION } from "./fixtures";

const V3_BODY = JSON.stringify({
  object: "prequalify_result",
  request_id: "req_01HZK2N5GQR9T8X4B6FJW3Y1AS",
  idempotency_key: "550e8400-e29b-41d4-a716-446655440000",
  livemode: false,
  data: { plans: [] },
});

const V3_REQUEST = {
  applicant: TEST_APPLICANT,
  coverage: TEST_COVERAGE,
  products: TEST_PRODUCTS,
} as const;

function recordingTransport(): { transport: Transport; requests: TransportRequest[] } {
  const requests: TransportRequest[] = [];
  const transport: Transport = async (request) => {
    requests.push(request);
    return { status: 200, body: V3_BODY, headers: {} };
  };
  return { transport, requests };
}

/** The Go verifier's canonical string: shared/go/auth/session/canonical.go. */
function expectedSignature(request: TransportRequest, path: string): string {
  const bodyHash = createHash("sha256").update(request.body ?? "").digest("hex");
  const canonical = [
    request.method,
    path,
    bodyHash,
    request.headers["X-Isa-Timestamp"],
    TEST_SESSION.sessionId,
  ].join("\n");
  return createHmac("sha256", TEST_SESSION.sessionSecret).update(canonical).digest("hex");
}

describe("Isa.create with SessionAuth — zyins v3 product calls", () => {
  test("signs prequalifyV3 with the supplied session and no other credential", async () => {
    const { transport, requests } = recordingTransport();
    const isa = await Isa.create({
      auth: SessionAuth.fromSession({
        sessionId: TEST_SESSION.sessionId,
        sessionSecret: TEST_SESSION.sessionSecret,
      }),
      engine: RemoteEngine.at("http://127.0.0.1:18080"),
      transport,
    });

    await isa.zyins.prequalifyV3(V3_REQUEST);

    const request = requests.at(-1);
    expect(request?.url).toBe("http://127.0.0.1:18080/v3/prequalify");
    expect(request?.headers["Authorization"]).toBe(`Session ${TEST_SESSION.sessionSecret}`);
    expect(request?.headers["X-Isa-Session-Id"]).toBe(TEST_SESSION.sessionId);
    expect(request?.headers["X-Isa-Signature"]).toBe(expectedSignature(request!, "/v3/prequalify"));
    // An embedded session carries no device binding and no license identity.
    expect(request?.headers["X-Device-ID"]).toBeUndefined();
    expect(request?.headers["X-Device-Signature"]).toBeUndefined();
  });

  test("signs quoteV3 against /v3/quote and never bootstraps another session", async () => {
    const { transport, requests } = recordingTransport();
    const isa = await Isa.create({
      auth: SessionAuth.fromSession({
        sessionId: TEST_SESSION.sessionId,
        sessionSecret: TEST_SESSION.sessionSecret,
      }),
      transport,
    });

    await isa.zyins.quoteV3(V3_REQUEST);

    const quote = requests.find((request) => request.url.endsWith("/v3/quote"));
    expect(quote?.headers["X-Isa-Signature"]).toBe(expectedSignature(quote!, "/v3/quote"));
    expect(requests.some((request) => request.url.endsWith("/v1/sessions"))).toBe(false);
  });

  test("sends a fresh X-Isa-Request-Id on every call so the verifier's replay cache never rejects a second call", async () => {
    const { transport, requests } = recordingTransport();
    const isa = await Isa.create({
      auth: SessionAuth.fromSession({
        sessionId: TEST_SESSION.sessionId,
        sessionSecret: TEST_SESSION.sessionSecret,
      }),
      transport,
    });

    await isa.zyins.prequalifyV3(V3_REQUEST);
    await isa.zyins.quoteV3(V3_REQUEST);

    const requestIds = requests.map((request) => request.headers["X-Isa-Request-Id"]);
    expect(requestIds).toHaveLength(2);
    for (const requestId of requestIds) {
      expect(requestId).toMatch(/^[0-9a-f-]{36}$/);
    }
    expect(new Set(requestIds).size).toBe(2);
  });

  test("refuses a session with no id or no secret", () => {
    expect(() => SessionAuth.fromSession({ sessionId: "", sessionSecret: TEST_SESSION.sessionSecret })).toThrow(
      /sessionId/,
    );
    expect(() => SessionAuth.fromSession({ sessionId: TEST_SESSION.sessionId, sessionSecret: "  " })).toThrow(
      /sessionSecret/,
    );
  });
});
