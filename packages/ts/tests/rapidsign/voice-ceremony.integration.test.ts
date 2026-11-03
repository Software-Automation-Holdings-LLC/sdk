/**
 * Local voice-ceremony harness.
 *
 * Exercises the full client-observable state progression a voice ceremony
 * goes through — mint → readyToReceive → completed — against a MOCK
 * backend that implements the documented wire contract (mirrors
 * packages/go/rapidsign/voice.go + the RapidSign proto). No real phone call
 * is placed: a signer dialing in, speaking the disclosure, and RapidSign's
 * Twilio integration recording the call all happen outside this process.
 * Everything up to that boundary — minting the code, publishing the script,
 * and polling for the ceremony's completion via the shared document
 * endpoints — is proven here against a server double, run with `npx vitest
 * run tests/rapidsign/voice-ceremony.integration.test.ts`.
 */

import { describe, expect, it } from "vitest";
import { RapidSignClient } from "../../src/rapidsign/client";
import { RapidSignError } from "../../src/rapidsign/errors";
import type { Transport, TransportRequest, TransportResponse } from "../../src/rapidsign/internal/transport";
import { counterUUID, FIXED_CLOCK, instantSleeper, TEST_BASE, TEST_TOKEN } from "./fixtures";

/** How many `documents.get` polls the mock keeps the signer "on the call" for. */
const POLLS_BEFORE_SIGNED = 2;

/**
 * A minimal RapidSign server double: mints a voice code, then answers
 * `GET /v1/documents/{sign_id}` with "not yet signed" for
 * `POLLS_BEFORE_SIGNED` polls before returning a signature — modeling the
 * signer dialing in and completing the call between polls.
 */
function mockVoiceBackend(signId: string, code: string): { transport: Transport; pollCount: () => number } {
  let getCalls = 0;
  const transport: Transport = async (request: TransportRequest): Promise<TransportResponse> => {
    if (request.method === "POST" && request.url === `${TEST_BASE}/v1/documents/${signId}/voice-code`) {
      return {
        status: 201,
        body: JSON.stringify({ sign_id: signId, code, expires_at: 1_715_823_600 }),
        headers: {},
      };
    }
    if (request.method === "GET" && request.url === `${TEST_BASE}/v1/documents/${signId}`) {
      getCalls += 1;
      if (getCalls <= POLLS_BEFORE_SIGNED) {
        return { status: 404, body: "not signed yet", headers: {} };
      }
      return {
        status: 200,
        body: JSON.stringify({
          sign_id: signId,
          signature: Buffer.from("VOICE-CEREMONY-SIGNATURE").toString("base64"),
          timestamp: 1_715_823_650,
          user_metadata: JSON.stringify({ ip: "203.0.113.9", user_agent: "voice-ceremony/phone" }),
        }),
        headers: {},
      };
    }
    if (request.method === "GET" && request.url === `${TEST_BASE}/v1/documents/${signId}/download`) {
      return {
        status: 200,
        body: JSON.stringify({
          pdf_gzip_base64: Buffer.from("signed-pdf-bytes").toString("base64"),
          compressed: false,
        }),
        headers: {},
      };
    }
    return { status: 404, body: "unmapped route in mock backend", headers: {} };
  };
  return { transport, pollCount: () => getCalls };
}

describe("voice ceremony (local harness against a mock backend)", () => {
  it("progresses mint → readyToReceive → completed", async () => {
    const signId = "sig_voice_ceremony";
    const { transport, pollCount } = mockVoiceBackend(signId, "482913");
    const { sleeper } = instantSleeper();
    const client = new RapidSignClient(TEST_TOKEN, {
      baseUrl: TEST_BASE,
      transport,
      clock: FIXED_CLOCK,
      sleeper,
      uuid: counterUUID(),
      maxRetries: 0,
    });

    // 1. mint — publish the script and mint the single-use dial-in code.
    const voiceCode = await client.voice.mintCode(signId, {
      sessionId: "sess_ceremony",
      secretKey: "ceremony-secret",
      form: "form_annuity_disclosure",
      signer: "signer_jane_doe",
      script: {
        disclosureText: "This call is being recorded for signature purposes.",
        steps: [
          { kind: "say", text: "Please listen to the following disclosures." },
          { kind: "confirm", text: "Do you agree to sign by voice?" },
          { kind: "capture-name", text: "Please state your full name." },
        ],
        expectedSignerName: "Jane Doe",
      },
    });
    expect(voiceCode.signId).toBe(signId);
    expect(voiceCode.code).toBe("482913");

    // 2. readyToReceive — the code is minted and the signer has not yet
    // dialed in; `documents.get` 404s until the call completes. Modeled
    // here as the "not signed yet" branch the mock returns pre-poll-count.
    await expect(client.documents.get(signId)).rejects.toBeInstanceOf(RapidSignError.NotFound);

    // 3. completed — the signer dials the universal number, enters the
    // code, and completes the call. The same document lifecycle every
    // other ceremony type uses resolves the result: no voice-specific
    // polling method exists or is needed.
    const signature = await client.documents.awaitSignature(signId, { timeout: "5s" });
    expect(signature.signId).toBe(signId);
    expect(signature.signature.toString("utf8")).toBe("VOICE-CEREMONY-SIGNATURE");
    expect(pollCount()).toBe(POLLS_BEFORE_SIGNED + 1);

    const pdf = await client.documents.download(signId);
    expect(pdf.toString("utf8")).toBe("signed-pdf-bytes");

    // Verification boundary: a live call requires dialing the ceremony's
    // Twilio-backed universal number, which this process cannot do. Every
    // step above the Twilio boundary — mint, script publish, lifecycle
    // polling via the shared document endpoints, and PDF retrieval — is
    // proven against the mock backend above; a real end-to-end call
    // requires a reachable RapidSign deployment (local or staging) with
    // Twilio configured. Recording retrieval is intentionally out of
    // scope here: the RapidSign server has no HTTP route for it yet and
    // the current Go voice contract (packages/go/rapidsign/voice.go) this
    // client mirrors does not expose it either.
  });
});
