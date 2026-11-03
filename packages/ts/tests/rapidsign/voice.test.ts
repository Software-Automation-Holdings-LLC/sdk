import { describe, expect, it } from "vitest";
import { RapidSignClient } from "../../src/rapidsign/client";
import { RapidSignError } from "../../src/rapidsign/errors";
import type { MintCodeRequest, VoiceScript } from "../../src/rapidsign/types";
import { counterUUID, FIXED_CLOCK, instantSleeper, queueTransport, TEST_BASE, TEST_TOKEN } from "./fixtures";

function newClient(transport: ReturnType<typeof queueTransport>["transport"]): RapidSignClient {
  const { sleeper } = instantSleeper();
  return new RapidSignClient(TEST_TOKEN, {
    baseUrl: TEST_BASE,
    transport,
    clock: FIXED_CLOCK,
    sleeper,
    uuid: counterUUID(),
    maxRetries: 0,
  });
}

const MINT_REQUEST: MintCodeRequest = {
  sessionId: "sess_1",
  secretKey: "shh",
  form: "form_1",
  signer: "signer_1",
};

const SCRIPT: VoiceScript = {
  disclosureText: "This call is being recorded.",
  steps: [
    { kind: "say", text: "Please listen carefully." },
    { kind: "capture-name", text: "Please say your full name." },
  ],
  expectedSignerName: "Jane Doe",
};

describe("voice.mintCode", () => {
  it("posts to the voice-code route and returns a typed VoiceCode", async () => {
    const { transport, calls } = queueTransport([
      {
        status: 201,
        body: JSON.stringify({ sign_id: "sig_abc", code: "482913", expires_at: 1_715_823_600 }),
      },
    ]);
    const client = newClient(transport);
    const code = await client.voice.mintCode("sig_abc", MINT_REQUEST);

    expect(calls).toHaveLength(1);
    expect(calls[0]!.request.url).toBe(`${TEST_BASE}/v1/documents/sig_abc/voice-code`);
    expect(calls[0]!.request.method).toBe("POST");
    expect(code.signId).toBe("sig_abc");
    expect(code.code).toBe("482913");
    expect(code.expiresAt).toBeInstanceOf(Date);
    expect(code.expiresAt.getTime()).toBe(1_715_823_600_000);
  });

  it("omits voice_script from the wire body when no script is supplied", async () => {
    const { transport, calls } = queueTransport([
      { status: 201, body: JSON.stringify({ sign_id: "sig_abc", code: "482913", expires_at: 1 }) },
    ]);
    const client = newClient(transport);
    await client.voice.mintCode("sig_abc", MINT_REQUEST);
    const body = JSON.parse(calls[0]!.request.body) as { voice_script?: unknown };
    expect(body.voice_script).toBeUndefined();
  });

  it("publishes the voice script on the wire body when supplied", async () => {
    const { transport, calls } = queueTransport([
      { status: 201, body: JSON.stringify({ sign_id: "sig_abc", code: "111222", expires_at: 1 }) },
    ]);
    const client = newClient(transport);
    await client.voice.mintCode("sig_abc", { ...MINT_REQUEST, script: SCRIPT });

    const body = JSON.parse(calls[0]!.request.body) as {
      session_id: string;
      secret_key: string;
      form: string;
      signer: string;
      voice_script: {
        disclosure_text: string;
        steps: Array<{ kind: string; text: string }>;
        expected_signer_name: string;
      };
    };
    expect(body.session_id).toBe("sess_1");
    expect(body.secret_key).toBe("shh");
    expect(body.form).toBe("form_1");
    expect(body.signer).toBe("signer_1");
    expect(body.voice_script.disclosure_text).toBe(SCRIPT.disclosureText);
    expect(body.voice_script.steps).toHaveLength(2);
    expect(body.voice_script.steps[1]!.kind).toBe("capture-name");
    expect(body.voice_script.expected_signer_name).toBe("Jane Doe");
  });

  it("rejects an empty sign id at the SDK boundary", async () => {
    const { transport } = queueTransport([]);
    const client = newClient(transport);
    await expect(client.voice.mintCode("", MINT_REQUEST)).rejects.toBeInstanceOf(
      RapidSignError.ValidationError,
    );
  });

  it.each([
    ["sessionId", { ...MINT_REQUEST, sessionId: "" }],
    ["secretKey", { ...MINT_REQUEST, secretKey: "" }],
    ["form", { ...MINT_REQUEST, form: "" }],
    ["signer", { ...MINT_REQUEST, signer: "" }],
  ])("rejects a missing %s at the SDK boundary", async (_field, request) => {
    const { transport } = queueTransport([]);
    const client = newClient(transport);
    await expect(client.voice.mintCode("sig_abc", request)).rejects.toBeInstanceOf(
      RapidSignError.ValidationError,
    );
  });

  it("translates a 429 ProblemDetails into a typed RateLimited error", async () => {
    const { transport } = queueTransport([
      {
        status: 429,
        body: JSON.stringify({
          type: "t",
          title: "Too Many Requests",
          status: 429,
          code: "rate_limit_exceeded",
          detail: "too many voice codes minted recently; try again shortly",
        }),
      },
    ]);
    const client = newClient(transport);
    await expect(client.voice.mintCode("sig_abc", MINT_REQUEST)).rejects.toBeInstanceOf(
      RapidSignError.RateLimited,
    );
  });

  it("throws Unknown when the server echoes a mismatched sign_id", async () => {
    const { transport } = queueTransport([
      // Server echoes a sign_id for a different document than the one
      // addressed in the request path.
      { status: 201, body: JSON.stringify({ sign_id: "sig_wrong", code: "482913", expires_at: 1 }) },
    ]);
    const client = newClient(transport);
    await expect(client.voice.mintCode("sig_abc", MINT_REQUEST)).rejects.toBeInstanceOf(
      RapidSignError.Unknown,
    );
  });

  it("throws Unknown when the server omits the code on a 2xx response", async () => {
    const { transport } = queueTransport([
      { status: 201, body: JSON.stringify({ sign_id: "sig_abc", expires_at: 1 }) },
    ]);
    const client = newClient(transport);
    await expect(client.voice.mintCode("sig_abc", MINT_REQUEST)).rejects.toBeInstanceOf(
      RapidSignError.Unknown,
    );
  });

  it("throws Unknown rather than minting a pre-expired code when the server omits expires_at", async () => {
    const { transport } = queueTransport([
      { status: 201, body: JSON.stringify({ sign_id: "sig_abc", code: "482913" }) },
    ]);
    const client = newClient(transport);
    await expect(client.voice.mintCode("sig_abc", MINT_REQUEST)).rejects.toBeInstanceOf(
      RapidSignError.Unknown,
    );
  });

  it("retries a transient 503 before succeeding", async () => {
    const { transport, calls } = queueTransport([
      { status: 503, body: "try again" },
      { status: 201, body: JSON.stringify({ sign_id: "sig_abc", code: "999888", expires_at: 1 }) },
    ]);
    const { sleeper, sleeps } = instantSleeper();
    const client = new RapidSignClient(TEST_TOKEN, {
      baseUrl: TEST_BASE,
      transport,
      clock: FIXED_CLOCK,
      sleeper,
      uuid: counterUUID(),
      maxRetries: 1,
    });
    const code = await client.voice.mintCode("sig_abc", MINT_REQUEST);
    expect(code.code).toBe("999888");
    expect(calls).toHaveLength(2);
    expect(sleeps.length).toBeGreaterThanOrEqual(1);
    // The retried attempt must carry the SAME Idempotency-Key as the first —
    // a fresh key per attempt would let the server treat a retry-after-
    // transient-error as an unrelated request and mint a second, orphaned
    // voice code for this sign_id.
    const firstKey = calls[0]!.request.headers["Idempotency-Key"];
    expect(typeof firstKey).toBe("string");
    expect(firstKey!.length).toBeGreaterThan(0);
    expect(calls[1]!.request.headers["Idempotency-Key"]).toBe(firstKey);
  });
});
