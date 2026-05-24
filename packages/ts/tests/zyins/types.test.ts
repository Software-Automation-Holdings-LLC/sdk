import { describe, expect, it } from "vitest";
import {
  Height,
  Weight,
  Sex,
} from "../../src/zyins/applicant";
import { Coverage } from "../../src/zyins/coverage";
import { isAuthContext } from "../../src/zyins/auth";
import {
  Products,
  ProductSelection,
  ProductType,
} from "../../src/zyins/product";

describe("Height / Weight factories", () => {
  it("Height.fromFeetInches sums to total inches", () => {
    expect(Height.fromFeetInches(5, 10).totalInches).toBe(70);
    expect(Height.fromFeetInches(6, 0).totalInches).toBe(72);
  });

  it("Height.fromFeetInches rejects negative inputs", () => {
    expect(() => Height.fromFeetInches(-1, 0)).toThrow();
    expect(() => Height.fromFeetInches(5, -1)).toThrow();
  });

  it("Weight.fromPounds requires positive", () => {
    expect(Weight.fromPounds(195).pounds).toBe(195);
    expect(() => Weight.fromPounds(0)).toThrow();
    expect(() => Weight.fromPounds(-1)).toThrow();
  });
});

describe("Sex canonical wire values", () => {
  it("Sex enum values are lowercase canonical strings the server accepts", () => {
    expect(Sex.Male).toBe("male");
    expect(Sex.Female).toBe("female");
  });
});

describe("Coverage discriminated union", () => {
  it("builds face_value coverage with rounded amount", () => {
    const c = Coverage.faceValue(100_000.6);
    expect(c.type).toBe("face_value");
    expect(c.amount).toBe(100_001);
    expect(Coverage.isFaceValue(c)).toBe(true);
  });

  it("builds monthly_budget coverage", () => {
    const c = Coverage.monthlyBudget(50);
    expect(c.type).toBe("monthly_budget");
    expect(c.amount).toBe(50);
    expect(Coverage.isMonthlyBudget(c)).toBe(true);
  });

  it("rejects non-positive amounts", () => {
    expect(() => Coverage.faceValue(0)).toThrow();
    expect(() => Coverage.monthlyBudget(-1)).toThrow();
  });
});

describe("Products catalog and ProductSelection (v0.5.3)", () => {
  it("looks up a product by wire token", () => {
    const product = Products.byWireToken('fex-aetna-accendo');
    expect(product?.wireToken).toBe('fex-aetna-accendo');
    expect(product?.productType).toBe(ProductType.FinalExpense);
  });

  it("returns undefined for unknown wire token", () => {
    expect(Products.byWireToken('not-a-token')).toBeUndefined();
  });

  it("emits a stable wire payload for a selection", () => {
    const fields = ProductSelection.of([
      Products.Fex['AetnaAccendo']!,
      Products.Fex['AmericoEaglePremier']!,
    ]).toWireFields();
    expect(fields.products).toEqual(['fex-aetna-accendo', 'fex-americo-eagle-premier']);
  });

  it("refuses an empty selection", () => {
    expect(() => ProductSelection.of([])).toThrow();
  });
});

describe("isAuthContext type guard", () => {
  it("accepts complete shapes", () => {
    expect(
      isAuthContext({
        licenseKey: "a",
        orderId: "b",
        email: "c@d.e",
        deviceId: "f",
      }),
    ).toBe(true);
  });

  it("rejects incomplete shapes", () => {
    expect(isAuthContext({ licenseKey: "a" })).toBe(false);
    expect(isAuthContext({})).toBe(false);
    expect(isAuthContext(null)).toBe(false);
    expect(isAuthContext({ licenseKey: "", orderId: "", email: "", deviceId: "" })).toBe(false);
  });
});
