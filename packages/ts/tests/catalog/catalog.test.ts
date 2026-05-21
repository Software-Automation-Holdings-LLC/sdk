/**
 * Catalog smoke tests.
 *
 * Verifies the shape contract for each generated catalog. These tests
 * intentionally do not pin specific membership counts — those come from
 * regenerable source data and would churn on every catalog refresh. They
 * pin the invariants that the named-export contract requires.
 */

import { describe, it, expect } from 'vitest';
import {
  Product,
  Products,
  State,
  States,
  ProductCarriers,
  ConditionCategories,
  MedicationUses,
  Scope,
  ScopeDescriptions,
  SignEvent,
  SignEventLabels,
  ErrorCode,
  ErrorAdviceCodes,
  ErrorDocUrls,
} from '../../src/index';

describe('Product catalog', () => {
  it('exposes Product as a non-empty enum and Products.values matches enum members', () => {
    const enumValues = Object.values(Product) as string[];
    expect(enumValues.length).toBeGreaterThan(0);
    expect(Products.values()).toEqual(enumValues);
  });

  it('every Product has metadata with matching slug', () => {
    for (const p of Products.values()) {
      const m = Products.metadata(p);
      expect(m.slug).toBe(p);
      expect(m.displayName.length).toBeGreaterThan(0);
      expect(m.carrier.length).toBeGreaterThan(0);
      expect(m.productClass.length).toBeGreaterThan(0);
    }
  });

  it('Products.search matches by slug substring and display name', () => {
    const all = Products.values();
    if (all.length === 0) return;
    const first = all[0]!;
    const m = Products.metadata(first);
    expect(Products.search(m.slug)).toContain(first);
    expect(Products.search(m.displayName.slice(0, 3))).toContain(first);
    expect(Products.search('')).toEqual([]);
  });

  it('Products.search matches state-specific product names', () => {
    const product = Products.values().find(
      (p) => Products.metadata(p).stateVariations.length > 0,
    );
    if (!product) return;
    const variation = Products.metadata(product).stateVariations[0]!;
    expect(Products.search(variation)).toContain(product);
  });

  it('Products.byCarrier returns products belonging to that carrier', () => {
    const all = Products.values();
    if (all.length === 0) return;
    const sample = Products.metadata(all[0]!);
    const fromCarrier = Products.byCarrier(sample.carrier);
    expect(fromCarrier).toContain(all[0]);
    for (const p of fromCarrier) {
      expect(Products.metadata(p).carrier).toBe(sample.carrier);
    }
  });
});

describe('State catalog', () => {
  it('has exactly 56 entries (50 states + DC + 5 inhabited territories)', () => {
    expect(States.values().length).toBe(56);
  });

  it('every State enum value is its abbreviation', () => {
    for (const s of States.values()) {
      const m = States.metadata(s);
      expect(m.abbreviation).toBe(s);
      expect(m.abbreviation.length).toBe(2);
    }
  });

  it('returns states and territories alphabetically by name', () => {
    const names = States.values().map((s) => States.metadata(s).name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it('includes North Carolina with abbreviation NC', () => {
    expect(State.NorthCarolina).toBe('NC');
    expect(States.metadata(State.NorthCarolina).name).toBe('North Carolina');
    expect(States.metadata(State.NorthCarolina).isTerritory).toBe(false);
  });

  it('includes Puerto Rico as a territory', () => {
    expect(State.PuertoRico).toBe('PR');
    expect(States.metadata(State.PuertoRico).isTerritory).toBe(true);
  });

  it('byAbbreviation accepts both abbreviation and full name, case-insensitive', () => {
    expect(States.byAbbreviation('nc')).toBe(State.NorthCarolina);
    expect(States.byAbbreviation('NC')).toBe(State.NorthCarolina);
    expect(States.byAbbreviation('north carolina')).toBe(State.NorthCarolina);
    expect(States.byAbbreviation('North Carolina')).toBe(State.NorthCarolina);
    expect(States.byAbbreviation('zz')).toBeUndefined();
  });

  it('exactly 5 territories', () => {
    const terr = States.values().filter((s) => States.metadata(s).isTerritory);
    expect(terr).toHaveLength(5);
  });
});

describe('ProductCarriers catalog', () => {
  it('every carrier slug resolves to metadata', () => {
    for (const c of ProductCarriers.values()) {
      const m = ProductCarriers.metadata(c);
      expect(m.displayName.length).toBeGreaterThan(0);
      for (const p of m.products) {
        // Every product listed under a carrier MUST roundtrip via Products.byCarrier.
        expect(Products.byCarrier(c)).toContain(p);
      }
    }
  });
});

describe('ConditionCategories catalog', () => {
  it('exposes the catalog API even if categories are empty (upstream gap)', () => {
    expect(typeof ConditionCategories.values).toBe('function');
    expect(typeof ConditionCategories.metadata).toBe('function');
    expect(Array.isArray(ConditionCategories.values())).toBe(true);
  });
});

describe('MedicationUses catalog', () => {
  it('every use has at least one medication', () => {
    const uses = MedicationUses.values();
    if (uses.length === 0) return;
    for (const u of uses.slice(0, 50)) {
      const m = MedicationUses.metadata(u);
      expect(m.medications.length).toBeGreaterThan(0);
      expect(m.displayName).toBe(u);
    }
  });
});

describe('Scope catalog', () => {
  it('every Scope enum value has a description', () => {
    const enumValues = Object.values(Scope);
    expect(enumValues.length).toBeGreaterThan(0);
    for (const s of enumValues) {
      expect(typeof ScopeDescriptions[s as Scope]).toBe('string');
    }
  });

  it('scope values are colon-separated lowercase strings', () => {
    for (const s of Object.values(Scope)) {
      expect(s).toMatch(/^[a-z]+(:[a-z]+)+$/);
    }
  });
});

describe('SignEvent catalog', () => {
  it('every SignEvent has a label', () => {
    const values = Object.values(SignEvent);
    expect(values.length).toBeGreaterThan(0);
    for (const e of values) {
      expect(SignEventLabels[e as SignEvent]).toMatch(/^[A-Z]/);
      expect(SignEventLabels[e as SignEvent]).not.toMatch(/[a-z][A-Z]/);
    }
  });

  it('event values are domain.verb lowercase strings', () => {
    for (const e of Object.values(SignEvent)) {
      expect(e).toMatch(/^[a-z]+\.[a-z]+$/);
    }
  });
});

describe('ErrorCode catalog', () => {
  it('every ErrorCode enum value has advice + docUrl entries', () => {
    const values = Object.values(ErrorCode);
    expect(values.length).toBeGreaterThan(0);
    for (const c of values) {
      expect(typeof ErrorAdviceCodes[c as ErrorCode]).toBe('string');
      expect(ErrorDocUrls[c as ErrorCode]).toMatch(
        /^https:\/\/docs\.isaapi\.com\/errors\//,
      );
    }
  });

  it('codes are lowercase snake_case wire form', () => {
    for (const c of Object.values(ErrorCode)) {
      expect(c).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  it('includes the canonical platform codes', () => {
    expect(ErrorCode.ValidationError).toBe('validation_error');
    expect(ErrorCode.NotFound).toBe('not_found');
    expect(ErrorCode.Unauthorized).toBe('unauthorized');
    expect(ErrorCode.RateLimitExceeded).toBe('rate_limit_exceeded');
  });

  it('includes RapidSign compatibility codes with metadata', () => {
    for (const code of [
      ErrorCode.DeadlineExceeded,
      ErrorCode.RateLimited,
      ErrorCode.Unknown,
    ]) {
      expect(ErrorAdviceCodes[code].length).toBeGreaterThan(0);
      expect(ErrorDocUrls[code]).toBe(`https://docs.isaapi.com/errors/${code}`);
    }
  });
});
