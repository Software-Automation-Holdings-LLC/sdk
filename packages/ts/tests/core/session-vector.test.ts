/**
 * Bytewise conformance gate for the steady-state session-HMAC signature.
 *
 * The fixture at tests/conformance/fixtures/session-vector.json (repo
 * root) is the binding contract. Sibling SDKs in Go, Python, PHP, and
 * C# MUST reproduce the identical canonical string, signature, and
 * Authorization header against the same inputs.
 *
 * This is exactly the drift that shipped in all five SDKs: hard-coding
 * `Bearer <secret>` instead of `Session <secret>`. This gate turns that
 * class of bug into a CI failure.
 *
 * If this test fails after an intentional change to the session wire
 * format, regenerate the fixture (see its $comment for the
 * regeneration recipe), update shared/go/auth/session/canonical.go's
 * doc comment if the shape changed, and bump every SDK's major
 * version — the change is breaking.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { canonicalString, signRequest } from "../../src/core/auth/signRequest";

interface SessionVectorFixture {
  readonly inputs: {
    readonly sessionId: string;
    readonly sessionSecret: string;
    readonly method: string;
    readonly path: string;
    readonly body: string;
    readonly timestamp: string;
  };
  readonly canonical: string;
  readonly expected: {
    readonly algorithm: "HMAC-SHA256";
    readonly signature: string;
    readonly header: string;
  };
}

/**
 * Confirms the committed fixture (repo-controlled, not external/user
 * input) still has the fields this spec reads before we trust it as
 * `SessionVectorFixture`. A shape drift here means someone hand-edited
 * the fixture — fail loudly instead of letting `undefined` silently
 * flow into the HMAC inputs below.
 */
function isSessionVectorFixture(value: unknown): value is SessionVectorFixture {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  const inputs = candidate.inputs as Record<string, unknown> | undefined;
  const expected = candidate.expected as Record<string, unknown> | undefined;
  return (
    typeof inputs?.sessionId === "string"
    && typeof inputs?.sessionSecret === "string"
    && typeof inputs?.method === "string"
    && typeof inputs?.path === "string"
    && typeof inputs?.body === "string"
    && typeof inputs?.timestamp === "string"
    && typeof candidate.canonical === "string"
    && typeof expected?.signature === "string"
    && typeof expected?.header === "string"
  );
}

function loadSessionVectorFixture(): SessionVectorFixture {
  const fixturePath = resolve(
    __dirname,
    "..",
    "..",
    "..",
    "..",
    "tests",
    "conformance",
    "fixtures",
    "session-vector.json",
  );
  const parsed: unknown = JSON.parse(readFileSync(fixturePath, "utf8"));
  if (!isSessionVectorFixture(parsed)) {
    throw new Error(`session-vector.json at ${fixturePath} is missing required fields`);
  }
  return parsed;
}

const fixture = loadSessionVectorFixture();

describe("steady-state session-HMAC signature — session vector", () => {
  it("builds the canonical signing string per the documented form", async () => {
    const canonical = await canonicalString(
      fixture.inputs.method,
      fixture.inputs.path,
      fixture.inputs.body,
      fixture.inputs.timestamp,
      fixture.inputs.sessionId,
    );
    expect(canonical).toBe(fixture.canonical);
  });

  it("reproduces the documented signature bytewise", async () => {
    const result = await signRequest({
      method: fixture.inputs.method,
      path: fixture.inputs.path,
      body: fixture.inputs.body,
      sessionId: fixture.inputs.sessionId,
      sessionSecret: fixture.inputs.sessionSecret,
      clock: () => new Date(fixture.inputs.timestamp),
    });
    expect(result.headers["X-Isa-Signature"]).toBe(fixture.expected.signature);
  });

  it("emits the Session Authorization scheme, never Bearer", async () => {
    const result = await signRequest({
      method: fixture.inputs.method,
      path: fixture.inputs.path,
      body: fixture.inputs.body,
      sessionId: fixture.inputs.sessionId,
      sessionSecret: fixture.inputs.sessionSecret,
      clock: () => new Date(fixture.inputs.timestamp),
    });
    expect(result.headers.Authorization).toBe(fixture.expected.header);
    expect(result.headers.Authorization.startsWith("Bearer ")).toBe(false);
  });
});
