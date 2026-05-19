import { describe, expect, it } from "vitest";
import {
  buildLicenseHMACHeaders,
  buildLicenseHeader,
  computeDeviceSignature,
  stripQuotes,
} from "../../src/core/license/deviceAuth";

const DEVICE_ID = "device-xyz-123";
const LICENSE = "LIC-ABC";
const ORDER = "ORD-42";
const EMAIL = "zach@zysys.org";
const FIXED_TIME = 1_700_000_000_000;

describe("stripQuotes", () => {
  it("strips matched leading/trailing double quotes", () => {
    expect(stripQuotes("\"foo\"")).toBe("foo");
  });

  it("leaves unquoted strings alone", () => {
    expect(stripQuotes("foo")).toBe("foo");
  });

  it("does not strip mismatched quotes", () => {
    expect(stripQuotes("\"foo")).toBe("\"foo");
    expect(stripQuotes("foo\"")).toBe("foo\"");
  });

  it("handles the empty and single-char cases", () => {
    expect(stripQuotes("")).toBe("");
    expect(stripQuotes("\"")).toBe("\"");
  });
});

describe("computeDeviceSignature", () => {
  it("returns a 64-char hex string", async () => {
    const sig = await computeDeviceSignature("body", DEVICE_ID);
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic for the same inputs", async () => {
    const a = await computeDeviceSignature("body", DEVICE_ID);
    const b = await computeDeviceSignature("body", DEVICE_ID);
    expect(a).toBe(b);
  });

  it("changes when the body changes", async () => {
    const a = await computeDeviceSignature("body1", DEVICE_ID);
    const b = await computeDeviceSignature("body2", DEVICE_ID);
    expect(a).not.toBe(b);
  });

  it("changes when the device id changes", async () => {
    const a = await computeDeviceSignature("body", "device-a");
    const b = await computeDeviceSignature("body", "device-b");
    expect(a).not.toBe(b);
  });

  it("ignores wrapping quotes on the device id", async () => {
    const a = await computeDeviceSignature("body", DEVICE_ID);
    const b = await computeDeviceSignature("body", `"${DEVICE_ID}"`);
    expect(a).toBe(b);
  });
});

describe("buildLicenseHeader", () => {
  it("returns a base64-encoded License payload", () => {
    const h = buildLicenseHeader(LICENSE, ORDER, EMAIL);
    expect(h.startsWith("License ")).toBe(true);
    const payload = h.slice("License ".length);
    const decoded = Buffer.from(payload, "base64").toString("utf8");
    expect(decoded).toBe(`${LICENSE}:${ORDER}:${EMAIL}`);
  });

  it("encodes international (non-Latin-1) email addresses without throwing", () => {
    const intlEmail = "josé@exämple.com";
    const h = buildLicenseHeader(LICENSE, ORDER, intlEmail);
    const payload = h.slice("License ".length);
    const decoded = Buffer.from(payload, "base64").toString("utf8");
    expect(decoded).toBe(`${LICENSE}:${ORDER}:${intlEmail}`);
  });

  it("round-trips CJK characters in the license payload", () => {
    const cjkEmail = "测试@例子.测试";
    const h = buildLicenseHeader(LICENSE, ORDER, cjkEmail);
    const payload = h.slice("License ".length);
    const decoded = Buffer.from(payload, "base64").toString("utf8");
    expect(decoded).toBe(`${LICENSE}:${ORDER}:${cjkEmail}`);
  });
});

describe("buildLicenseHMACHeaders", () => {
  it("emits all required HMAC headers with consistent signature", async () => {
    const h = await buildLicenseHMACHeaders(
      LICENSE,
      ORDER,
      EMAIL,
      "POST",
      "/v1/accounts",
      "{\"x\":1}",
      DEVICE_ID,
      () => FIXED_TIME,
    );
    expect(h.Authorization.startsWith("License ")).toBe(true);
    expect(h["X-Device-ID"]).toBe(DEVICE_ID);
    expect(h["X-Device-Signature"]).toMatch(/^[0-9a-f]{64}$/);
    expect(h["X-License-Method"]).toBe("POST");
    expect(h["X-License-URI"]).toBe("/v1/accounts");
    expect(h["X-License-Timestamp"]).toBe(String(FIXED_TIME));
  });

  it("produces matching signatures for identical canonical inputs", async () => {
    const h1 = await buildLicenseHMACHeaders(
      LICENSE, ORDER, EMAIL, "POST", "/v1/a", "body", DEVICE_ID, () => FIXED_TIME,
    );
    const h2 = await buildLicenseHMACHeaders(
      LICENSE, ORDER, EMAIL, "POST", "/v1/a", "body", DEVICE_ID, () => FIXED_TIME,
    );
    expect(h1["X-Device-Signature"]).toBe(h2["X-Device-Signature"]);
  });

  it("produces different signatures when the URI changes", async () => {
    const h1 = await buildLicenseHMACHeaders(
      LICENSE, ORDER, EMAIL, "POST", "/v1/a", "body", DEVICE_ID, () => FIXED_TIME,
    );
    const h2 = await buildLicenseHMACHeaders(
      LICENSE, ORDER, EMAIL, "POST", "/v1/b", "body", DEVICE_ID, () => FIXED_TIME,
    );
    expect(h1["X-Device-Signature"]).not.toBe(h2["X-Device-Signature"]);
  });
});
