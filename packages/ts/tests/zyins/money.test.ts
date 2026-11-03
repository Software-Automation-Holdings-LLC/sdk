/**
 * 1.0 ergonomics — `formatMoney` renders an `OfferMoney` as a human string.
 * The goal is that a consumer never gets `[object Object]` (which crashes
 * React with error #31 when an object is rendered directly in JSX).
 */
import { describe, expect, it } from "vitest";
import { formatMoney, type OfferMoney } from "../../src/zyins";

describe("formatMoney", () => {
  it("prefers the server-provided display string verbatim", () => {
    const money: OfferMoney = { cents: 123456, display: "$1,234.56" };
    expect(formatMoney(money)).toBe("$1,234.56");
  });

  it("computes USD cents to $X,XXX.XX when no display string is present", () => {
    expect(formatMoney({ cents: 123456, display: "" })).toBe("$1,234.56");
  });

  it("renders zero as $0.00", () => {
    expect(formatMoney({ cents: 0, display: "" })).toBe("$0.00");
  });

  it("renders large values with grouping separators", () => {
    expect(formatMoney({ cents: 9_999_999_99, display: "" })).toBe("$9,999,999.99");
  });

  it("honors preferComputed even when a display string exists", () => {
    const money: OfferMoney = { cents: 500, display: "IGNORED" };
    expect(formatMoney(money, { preferComputed: true })).toBe("$5.00");
  });

  it("supports a non-USD locale and currency override", () => {
    const out = formatMoney({ cents: 123456, display: "" }, { locale: "de-DE", currency: "EUR" });
    // de-DE uses comma decimals, dot grouping, and a trailing euro sign.
    expect(out).toContain("1.234,56");
    expect(out).toContain("€");
  });

  it("uses the selected currency minor-unit scale for zero-decimal currencies", () => {
    expect(formatMoney({ cents: 1000, display: "" }, { currency: "JPY" })).toBe("¥1,000");
  });

  it("uses the selected currency minor-unit scale for three-decimal currencies", () => {
    const out = formatMoney({ cents: 1234, display: "" }, { currency: "KWD" });
    expect(out).toContain("KWD");
    expect(out).toContain("1.234");
  });

  it("supports currencyDisplay: code", () => {
    const out = formatMoney({ cents: 100, display: "" }, { currencyDisplay: "code" });
    expect(out).toContain("USD");
    expect(out).toContain("1.00");
  });

  it("never returns [object Object]", () => {
    const money: OfferMoney = { cents: 4200, display: "" };
    expect(formatMoney(money)).not.toContain("[object Object]");
    expect(`${formatMoney(money)}`).toBe("$42.00");
  });
});
