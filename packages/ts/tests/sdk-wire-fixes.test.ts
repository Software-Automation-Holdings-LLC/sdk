/**
 * Wire contract the proxy session verifier and salt proxy accept.
 *
 * These assertions name the bugs that shipped: a Bearer scheme on a
 * session secret, algosure helpers missing from the public surface, an
 * exports map with no require condition, an email body field the server
 * does not read, a GET that signs a non-empty body, and a salt fetch
 * that POSTs JSON instead of GET ?load=.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { enqueue } from "../src/account/email";
import { signRequest } from "../src/core/auth/signRequest";
import * as root from "../src/index";
import { computeAlgosureHMAC, DEFAULT_SALT_PROXY_URL } from "../src/proxy/algosure/hmac";

const FIXED = new Date("2026-01-15T10:00:00Z");

describe("signRequest scheme", () => {
  it("emits Authorization: Session, never Bearer", async () => {
    const { headers } = await signRequest({
      method: "POST",
      path: "/v1/call",
      body: "{}",
      sessionId: "sess_test",
      sessionSecret: "secret_test",
      clock: () => FIXED,
    });
    expect(headers.Authorization).toBe("Session secret_test");
    expect(headers.Authorization.startsWith("Bearer ")).toBe(false);
  });
});

describe("public algosure helpers", () => {
  it("re-exports the algosure helpers from the package root", () => {
    const surface = root as Record<string, unknown>;
    expect(typeof surface["computeAlgosureHMAC"]).toBe("function");
    expect(typeof surface["buildAlgosureHeaders"]).toBe("function");
    expect(typeof surface["deriveSimpleKey"]).toBe("function");
    expect(typeof surface["buildEmbeddedAlgosureHeaders"]).toBe("function");
    expect(typeof surface["computeEmbeddedAlgosureHMAC"]).toBe("function");
  });
});

describe("exports map", () => {
  it("declares a require condition on the package root", () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, "../package.json"), "utf8")) as {
      exports: { ".": Record<string, string> };
    };
    expect(pkg.exports["."].require).toBe("./dist/index.js");
  });
});

describe("email enqueue wire", () => {
  it("sends body_html, not body", async () => {
    const requests: Array<{ body: string }> = [];
    await enqueue(
      { to: "a@example.com", subject: "Hi", body: "<p>Hello</p>" },
      {
        baseUrl: "https://test.example",
        auth: {
          licenseKey: "lk",
          orderId: "ord",
          email: "a@example.com",
          deviceId: "dev",
        },
        transport: async (req) => {
          requests.push({ body: req.body });
          return { status: 200, body: JSON.stringify({ status: "queued" }), headers: {} };
        },
        clock: () => FIXED.getTime(),
      },
    );
    const sent = JSON.parse(requests[0]!.body) as Record<string, unknown>;
    expect(sent["body_html"]).toBe("<p>Hello</p>");
    expect(sent).not.toHaveProperty("body");
  });
});

describe("GET signing body", () => {
  it("signs an empty string when the verb is GET", async () => {
    const get = await signRequest({
      method: "GET",
      path: "/v1/case/abc",
      body: "{\"ignored\":true}",
      sessionId: "sess_test",
      sessionSecret: "secret_test",
      clock: () => FIXED,
    });
    const empty = await signRequest({
      method: "get",
      path: "/v1/case/abc",
      body: "",
      sessionId: "sess_test",
      sessionSecret: "secret_test",
      clock: () => FIXED,
    });
    expect(get.headers["X-Isa-Signature"]).toBe(empty.headers["X-Isa-Signature"]);
  });
});

describe("salt proxy load parameter", () => {
  it("fetches the salt with GET and ?load=, and an empty body", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = vi.fn(async (url: RequestInfo | URL, init: RequestInit = {}) => {
      calls.push({ url: String(url), init });
      return { ok: true, text: async () => "abcdefghijklmnopqrstuvwxyz0123456789" } as Response;
    }) as unknown as typeof fetch;

    await computeAlgosureHMAC({
      host: "customer.example",
      method: "POST",
      path: "/v1/call",
      body: "{}",
      sessionId: "sess_test",
      time: FIXED.getTime(),
      fetchImpl,
    });

    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    const url = new URL(call.url);
    expect(url.origin + url.pathname).toBe(
      new URL(DEFAULT_SALT_PROXY_URL).origin + new URL(DEFAULT_SALT_PROXY_URL).pathname,
    );
    expect(url.searchParams.get("load")).toBe("customer.example");
    expect(call.init.method).toBe("GET");
    expect(call.init.body ?? "").toBe("");
  });
});
