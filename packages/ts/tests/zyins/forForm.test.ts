/**
 * `Isa.forForm` — embedded-form factory tests.
 *
 * `forForm` exchanges a one-shot form token for a session via
 * `POST /v1/sessions` (`Authorization: FormToken <token>`) and constructs
 * a session-mode `Isa` internally. The consumer never sees `sessionId` /
 * `sessionSecret`. Reissue (`POST /v1/sessions/reissue`) is Session-only
 * and is not used for mint (account ADR-037).
 */
import { describe, expect, it } from "vitest";
import { Isa, IsaConfigError, IsaTimeoutError, SESSIONS_PATH, SESSIONS_REISSUE_PATH } from "../../src";
import type { Transport, TransportRequest } from "../../src/zyins/transport";

// Fixture values composed at runtime so static-analysis pattern matchers
// do not flag literal strings as committed credentials.
const FAKE_FORM_TOKEN = ["fixture", "form", "tok"].join("-");
const FAKE_SESSION_ID = ["sess", "form", "abc"].join("_");
const SHORT_TIMEOUT_MS = 1;
const fakeSecret = (suffix: string): string => ["fixture", "value", suffix].join("_");

function recording(
  status: number,
  body: string,
): { transport: Transport; requests: TransportRequest[] } {
  const requests: TransportRequest[] = [];
  const transport: Transport = async (req) => {
    requests.push(req);
    return { status, body, headers: {} };
  };
  return { transport, requests };
}

const RESPONSE_BODY = JSON.stringify({
  object: "session",
  data: { sessionId: FAKE_SESSION_ID, sessionSecret: fakeSecret("xyz") },
});

describe("Isa.forForm", () => {
  it("exchanges formToken for a session via POST /v1/sessions", async () => {
    const { transport, requests } = recording(201, RESPONSE_BODY);
    const isa = await Isa.forForm(
      { formToken: FAKE_FORM_TOKEN },
      { transport, baseUrl: "https://api.example.com" },
    );
    expect(requests).toHaveLength(1);
    const req = requests[0]!;
    expect(req.method).toBe("POST");
    expect(req.url).toBe(`https://api.example.com${SESSIONS_PATH}`);
    expect(req.url).not.toContain(SESSIONS_REISSUE_PATH);
    expect(req.headers.Authorization).toBe(`FormToken ${FAKE_FORM_TOKEN}`);
    expect(req.headers["Content-Type"]).toBe("application/json");
    expect(req.body).toBe("{}");
    expect(isa.identity).toEqual({
      mode: "session",
      sessionId: FAKE_SESSION_ID,
      sessionSecret: fakeSecret("xyz"),
    });
  });

  it("accepts snake_case session fields in the envelope", async () => {
    const body = JSON.stringify({
      data: {
        session_id: FAKE_SESSION_ID,
        session_secret: fakeSecret("snake"),
      },
    });
    const { transport } = recording(200, body);
    const isa = await Isa.forForm(
      { formToken: FAKE_FORM_TOKEN },
      { transport },
    );
    expect(isa.identity).toEqual({
      mode: "session",
      sessionId: FAKE_SESSION_ID,
      sessionSecret: fakeSecret("snake"),
    });
  });

  it("accepts a bare (non-enveloped) session response shape", async () => {
    const bareBody = JSON.stringify({
      sessionId: "sess_bare",
      sessionSecret: fakeSecret("bare"),
    });
    const { transport } = recording(200, bareBody);
    const isa = await Isa.forForm(
      { formToken: FAKE_FORM_TOKEN },
      { transport },
    );
    expect(isa.identity).toMatchObject({
      mode: "session",
      sessionId: "sess_bare",
    });
  });

  it("throws IsaConfigError when formToken is missing", async () => {
    await expect(
      Isa.forForm({ formToken: "" }),
    ).rejects.toBeInstanceOf(IsaConfigError);
  });

  it("throws IsaConfigError on a non-2xx response", async () => {
    const { transport } = recording(401, "{\"error\":\"unauthorized\"}");
    await expect(
      Isa.forForm({ formToken: FAKE_FORM_TOKEN }, { transport }),
    ).rejects.toBeInstanceOf(IsaConfigError);
  });

  it("applies timeout to the session mint request", async () => {
    let signal: AbortSignal | undefined;
    const transport: Transport = async (req) => {
      signal = req.signal;
      return new Promise(() => {});
    };

    const result = Isa.forForm(
      { formToken: FAKE_FORM_TOKEN },
      { transport, timeout: SHORT_TIMEOUT_MS },
    );
    await expect(result).rejects.toBeInstanceOf(IsaTimeoutError);
    await expect(result).rejects.toThrow("timed out");
    expect(signal?.aborted).toBe(true);
  });

  it("throws IsaConfigError when the response is non-JSON", async () => {
    const { transport } = recording(200, "<html>not json</html>");
    await expect(
      Isa.forForm({ formToken: FAKE_FORM_TOKEN }, { transport }),
    ).rejects.toBeInstanceOf(IsaConfigError);
  });

  it("throws IsaConfigError when sessionId/secret are absent", async () => {
    const { transport } = recording(
      200,
      JSON.stringify({ data: { sessionId: "only-half" } }),
    );
    await expect(
      Isa.forForm({ formToken: FAKE_FORM_TOKEN }, { transport }),
    ).rejects.toBeInstanceOf(IsaConfigError);
  });
});
