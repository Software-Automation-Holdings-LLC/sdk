import { describe, expect, it } from "vitest";
import { isIso8601Duration, parseDuration, MAX_DURATION_MS } from "../../src/rapidsign/internal/duration";
import { decodeGzipBase64 } from "../../src/rapidsign/internal/decompress";
import { RapidSignError } from "../../src/rapidsign/errors";
import { defaultSleeper, defaultUUIDGenerator, systemClock } from "../../src/rapidsign/internal/random";
import { gzipSync } from "node:zlib";

describe("parseDuration", () => {
  it("accepts a millisecond number unchanged", () => {
    expect(parseDuration(500)).toBe(500);
    expect(parseDuration(0)).toBe(0);
  });

  it("accepts ISO-8601 durations", () => {
    expect(parseDuration("P1D")).toBe(86_400_000);
    expect(parseDuration("PT24H")).toBe(86_400_000);
    expect(parseDuration("PT5M")).toBe(300_000);
    expect(parseDuration("PT15S")).toBe(15_000);
    expect(parseDuration("P1DT12H")).toBe(86_400_000 + 12 * 3_600_000);
  });

  it("accepts shorthand strings", () => {
    expect(parseDuration("500ms")).toBe(500);
    expect(parseDuration("30s")).toBe(30_000);
    expect(parseDuration("5m")).toBe(300_000);
    expect(parseDuration("2h")).toBe(7_200_000);
    expect(parseDuration("7d")).toBe(604_800_000);
  });

  it("rejects malformed values", () => {
    expect(() => parseDuration("garbage")).toThrow(RapidSignError.ValidationError);
    expect(() => parseDuration("PXY")).toThrow(RapidSignError.ValidationError);
    expect(() => parseDuration(-1)).toThrow(RapidSignError.ValidationError);
    expect(() => parseDuration(NaN)).toThrow(RapidSignError.ValidationError);
    expect(() => parseDuration("")).toThrow(RapidSignError.ValidationError);
  });

  it("rejects degenerate ISO-8601 durations without components", () => {
    expect(isIso8601Duration("P")).toBe(false);
    expect(isIso8601Duration("PT")).toBe(false);
    expect(() => parseDuration("P")).toThrow(RapidSignError.ValidationError);
    expect(() => parseDuration("PT")).toThrow(RapidSignError.ValidationError);
  });

  it("accepts explicit zero ISO-8601 durations", () => {
    expect(isIso8601Duration("PT0S")).toBe(true);
    expect(isIso8601Duration("P0D")).toBe(true);
    expect(parseDuration("PT0S")).toBe(0);
  });

  it("exposes MAX_DURATION_MS at 7 days", () => {
    expect(MAX_DURATION_MS).toBe(7 * 86_400_000);
  });
});

describe("decodeGzipBase64", () => {
  it("round-trips a UTF-8 payload", () => {
    const original = "the quick brown fox";
    const base64 = gzipSync(Buffer.from(original, "utf8")).toString("base64");
    expect(decodeGzipBase64(base64).toString("utf8")).toBe(original);
  });

  it("honours a pluggable decompressor", () => {
    const buf = decodeGzipBase64("AAAA", () => Buffer.from("STUB"));
    expect(buf.toString("utf8")).toBe("STUB");
  });
});

describe("default facades", () => {
  it("systemClock returns a finite epoch-ms", () => {
    const t = systemClock();
    expect(Number.isFinite(t)).toBe(true);
    expect(t).toBeGreaterThan(1_600_000_000_000);
  });

  it("defaultUUIDGenerator returns a v4 uuid", () => {
    const id = defaultUUIDGenerator();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("defaultSleeper resolves after the requested time", async () => {
    const start = Date.now();
    await defaultSleeper(10);
    expect(Date.now() - start).toBeGreaterThanOrEqual(5);
  });

  it("defaultSleeper rejects when its signal is aborted", async () => {
    const c = new AbortController();
    c.abort();
    await expect(defaultSleeper(1_000, c.signal)).rejects.toMatchObject({ name: "AbortError" });
  });
});
