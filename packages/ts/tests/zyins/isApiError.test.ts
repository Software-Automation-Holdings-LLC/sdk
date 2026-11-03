/**
 * 1.0 ergonomics — `Isa.isApiError` (and narrower siblings) are prototype-
 * independent guards. They must keep working across a module boundary that
 * produced a second copy of the error class, which is exactly where
 * `instanceof` fails (vendored tarball, test mock, duplicated dependency).
 */
import { describe, expect, it } from "vitest";
import {
  Isa,
  IsaApiError,
  IsaError,
  IsaIdempotencyConflictError,
  IsaNotActivatedError,
  isApiError,
  isIdempotencyConflictError,
  isNotActivatedError,
} from "../../src/zyins";
// Not part of the public barrel; imported from the module for subclass coverage.
import { IsaUnauthorizedError, IsaValidationError } from "../../src/zyins/apiError";

/**
 * Simulate an error from a different copy of the SDK: a plain object that
 * carries the same non-enumerable brand the real constructor stamps, but
 * with no shared prototype (so `instanceof IsaApiError` is false).
 */
function crossCopyApiError(brandKey: string): object {
  const fake = { code: "validation_error", status: 400, message: "from a vendored copy" };
  Object.defineProperty(fake, brandKey, { value: true, enumerable: false });
  return fake;
}

describe("Isa.isApiError", () => {
  it("returns true for a same-module IsaApiError", () => {
    const err = new IsaApiError({ message: "boom", code: "validation_error", status: 400 });
    expect(Isa.isApiError(err)).toBe(true);
    expect(isApiError(err)).toBe(true);
  });

  it("returns true for every IsaApiError subclass", () => {
    const subclasses: IsaApiError[] = [
      new IsaUnauthorizedError({ message: "no" }),
      new IsaValidationError({ message: "bad" }),
      new IsaIdempotencyConflictError({ message: "dup", key: "k", firstSeenAt: "t" }),
    ];
    for (const err of subclasses) {
      expect(Isa.isApiError(err)).toBe(true);
    }
  });

  it("returns true for a cross-copy error carrying the brand, where instanceof fails", () => {
    const err = crossCopyApiError("__isaApiError");
    expect(err instanceof IsaApiError).toBe(false);
    expect(Isa.isApiError(err)).toBe(true);
  });

  it("returns false for a generic Error", () => {
    expect(Isa.isApiError(new Error("plain"))).toBe(false);
    expect(Isa.isApiError(new IsaError("base only"))).toBe(false);
  });

  it("returns false for null, undefined, and non-objects", () => {
    expect(Isa.isApiError(null)).toBe(false);
    expect(Isa.isApiError(undefined)).toBe(false);
    expect(Isa.isApiError("IsaApiError")).toBe(false);
    expect(Isa.isApiError(42)).toBe(false);
    expect(Isa.isApiError({ code: "validation_error" })).toBe(false);
  });
});

describe("Isa.isNotActivatedError", () => {
  it("returns true for a same-module IsaNotActivatedError", () => {
    const err = new IsaNotActivatedError("requires_activation");
    expect(Isa.isNotActivatedError(err)).toBe(true);
    expect(isNotActivatedError(err)).toBe(true);
  });

  it("returns true for a cross-copy error carrying the brand", () => {
    const fake = {};
    Object.defineProperty(fake, "__isaNotActivatedError", { value: true, enumerable: false });
    expect(fake instanceof IsaNotActivatedError).toBe(false);
    expect(Isa.isNotActivatedError(fake)).toBe(true);
  });

  it("returns false for an IsaApiError and for non-objects", () => {
    const apiErr = new IsaValidationError({ message: "bad" });
    expect(Isa.isNotActivatedError(apiErr)).toBe(false);
    expect(Isa.isNotActivatedError(null)).toBe(false);
    expect(Isa.isNotActivatedError(undefined)).toBe(false);
  });
});

describe("Isa.isIdempotencyConflictError", () => {
  it("returns true for a same-module conflict error and also passes isApiError", () => {
    const err = new IsaIdempotencyConflictError({ message: "dup", key: "k", firstSeenAt: "t" });
    expect(Isa.isIdempotencyConflictError(err)).toBe(true);
    expect(isIdempotencyConflictError(err)).toBe(true);
    expect(Isa.isApiError(err)).toBe(true);
  });

  it("returns true for a cross-copy error carrying the brand", () => {
    const fake = { key: "k", firstSeenAt: "t" };
    Object.defineProperty(fake, "__isaIdempotencyConflictError", { value: true, enumerable: false });
    expect(fake instanceof IsaIdempotencyConflictError).toBe(false);
    expect(Isa.isIdempotencyConflictError(fake)).toBe(true);
  });

  it("returns false for a plain IsaApiError and for non-objects", () => {
    const apiErr = new IsaApiError({ message: "x", code: "validation_error", status: 400 });
    expect(Isa.isIdempotencyConflictError(apiErr)).toBe(false);
    expect(Isa.isIdempotencyConflictError(null)).toBe(false);
  });
});

describe("error brands", () => {
  it("are non-enumerable so they never leak into JSON or Object.keys", () => {
    const err = new IsaApiError({ message: "boom", code: "validation_error", status: 400 });
    expect(Object.keys(err)).not.toContain("__isaApiError");
    expect(JSON.stringify({ ...err })).not.toContain("__isaApiError");
  });
});
