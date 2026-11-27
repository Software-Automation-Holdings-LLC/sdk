/**
 * Spec for the query-length-unbounded fuzzy fallback in
 * DefaultAutocompleteAlgorithm.
 *
 * rank() tokenizes the caller-supplied typeahead text with no length
 * cap. When the literal filter misses (the default fuzzy fallback's
 * trigger), every query word is compared with every token of every
 * candidate, and Double Metaphone is recomputed on the candidate token
 * for each pair. `limit` only trims the list returned after that scan.
 * The same loop backs conditions, medications, and concepts autocomplete.
 */

import { describe, expect, it } from "vitest";
import type { Concept } from "../../src/zyins/reference/Concept";
import { DefaultAutocompleteAlgorithm, Sort } from "../../src/zyins/reference/index";

const CATALOG_SIZE = 500;
const BASELINE_WORDS = 4;
const ATTACK_WORDS = 800;
const SCALE = 5;
const FLOOR_MS = 50;

function catalog(n: number): Concept[] {
  const out: Concept[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      id: `C${i}`,
      name: `Condition Alpha ${i}`,
      kind: "condition",
      isKnown: true,
      inputText: "",
      conditions: () => [],
      medications: () => [],
      equals: () => false,
    });
  }
  return out;
}

function query(words: number): string {
  return Array.from({ length: words }, () => "qx").join(" ");
}

describe("DefaultAutocompleteAlgorithm query bound", () => {
  const candidates = catalog(CATALOG_SIZE);
  const algo = new DefaultAutocompleteAlgorithm();

  async function elapsed(text: string, sort?: Sort): Promise<{ ms: number; count: number }> {
    const started = performance.now();
    const suggestions = await algo.rank(text, candidates, {
      limit: 1,
      kinds: [],
      frequencies: new Map(),
      ...(sort !== undefined && { sort }),
    });
    return { ms: performance.now() - started, count: suggestions.length };
  }

  function assertBounded(baselineMs: number, observedMs: number): void {
    const limit = Math.max(FLOOR_MS, baselineMs * SCALE);
    expect(observedMs, `rank took ${observedMs.toFixed(0)}ms; limit ${limit.toFixed(0)}ms`).toBeLessThanOrEqual(limit);
  }

  it("keeps a long unmatched query within a small multiple of a short one", async () => {
    const baseline = await elapsed(query(BASELINE_WORDS));
    const attack = await elapsed(query(ATTACK_WORDS));
    expect(baseline.count).toBe(0);
    expect(attack.count).toBe(0);
    assertBounded(baseline.ms, attack.ms);
  }, 60_000);

  it("keeps a long unmatched query bounded when the caller asks for alphabetical order", async () => {
    const baseline = await elapsed(query(BASELINE_WORDS), Sort.Alphabetical);
    const attack = await elapsed(query(ATTACK_WORDS), Sort.Alphabetical);
    expect(attack.count).toBe(0);
    assertBounded(baseline.ms, attack.ms);
  }, 60_000);
});
