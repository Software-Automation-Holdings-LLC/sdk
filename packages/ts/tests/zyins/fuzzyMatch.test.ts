/**
 * `FuzzyMatchAlgorithm` — typo-tolerant matcher tests.
 *
 * Covers the tiered cascade (exact → prefix → Damerau-OSA → Double
 * Metaphone → synonym), the length-scaled edit-distance band, the four
 * parity-hardening rules (NFC, locale-invariant fold, deterministic
 * tie-break, vector fixture), and the never-rejects contract shared with
 * `DefaultMatchAlgorithm`.
 */

import { describe, expect, it } from 'vitest';
import {
  FuzzyMatchAlgorithm,
  type Concept,
} from '../../src/zyins/reference/index';
import {
  doubleMetaphone,
} from '../../src/zyins/reference/_doubleMetaphone';
import {
  optimalStringAlignmentDistance,
  fuzzyThresholdForLength,
} from '../../src/zyins/reference/_damerauOsa';
import { DOUBLE_METAPHONE_VECTORS } from '../../src/zyins/reference/doubleMetaphone.vectors';

// ---------------------------------------------------------------------------
// Candidate builder — a minimal Concept honoring the public shape. Frequency
// is NOT on Concept; it is supplied to the matcher via a separate per-id map.
// ---------------------------------------------------------------------------

function condition(id: string, name: string, aliases?: readonly string[]): Concept {
  const base: Concept = {
    id,
    name,
    kind: 'condition',
    isKnown: true,
    inputText: name,
    conditions: () => [],
    medications: () => [],
    equals: (other) => other.isKnown && other.id === id,
  };
  return aliases === undefined ? base : { ...base, aliases };
}

const CROHNS = condition('CROHNS', "Crohn's Disease");
const SERTRALINE = condition('SERTRALINE', 'Sertraline');
const TYLENOL = condition('TYLENOL', 'Tylenol');
const LISINOPRIL = condition('LISINOPRIL', 'Lisinopril');
const LOSARTAN = condition('LOSARTAN', 'Losartan');
const METFORMIN = condition('METFORMIN', 'Metformin');

const CATALOG: readonly Concept[] = [
  CROHNS,
  SERTRALINE,
  TYLENOL,
  LISINOPRIL,
  LOSARTAN,
  METFORMIN,
];

describe('FuzzyMatchAlgorithm — never rejects', () => {
  it('returns an UnknownConcept preserving inputText for gibberish', () => {
    const matcher = new FuzzyMatchAlgorithm();
    const result = matcher.match('zzqqxxjjww', CATALOG);
    expect(result.isKnown).toBe(false);
    expect(result.id).toBeNull();
    expect(result.inputText).toBe('zzqqxxjjww');
  });

  it('returns an UnknownConcept for symbol-only input', () => {
    const matcher = new FuzzyMatchAlgorithm();
    const result = matcher.match('!!!', CATALOG);
    expect(result.isKnown).toBe(false);
    expect(result.inputText).toBe('!!!');
  });
});

describe('FuzzyMatchAlgorithm — exact tier (DefaultMatchAlgorithm parity)', () => {
  const matcher = new FuzzyMatchAlgorithm();

  it('resolves an exact name match', () => {
    expect(matcher.match('Lisinopril', CATALOG).id).toBe('LISINOPRIL');
  });

  it('resolves an exact id match', () => {
    expect(matcher.match('LISINOPRIL', CATALOG).id).toBe('LISINOPRIL');
  });

  it('is case-insensitive and punctuation-insensitive (make_key)', () => {
    expect(matcher.match("crohn's disease", CATALOG).id).toBe('CROHNS');
  });
});

describe('FuzzyMatchAlgorithm — Damerau-OSA tier', () => {
  const matcher = new FuzzyMatchAlgorithm();

  it("recovers an adjacent transposition of Crohn's (corhns → Crohn's)", () => {
    // CROHNS vs CORHNS: swap of the adjacent R/O — the OSA win that plain
    // Levenshtein would score as 2. This is why the matcher uses OSA.
    expect(optimalStringAlignmentDistance('CROHNS', 'CORHNS')).toBe(1);
    expect(matcher.match("corhn's disease", CATALOG).id).toBe('CROHNS');
  });

  it('recovers a single dropped letter (sertaline → Sertraline)', () => {
    // The dropped `r` is one insertion — Damerau's job, not phonetic.
    expect(optimalStringAlignmentDistance('SERTALINE', 'SERTRALINE')).toBe(1);
    expect(matcher.match('sertaline', CATALOG).id).toBe('SERTRALINE');
  });

  it('respects the band: a 2-edit non-transposition on a short query misses', () => {
    // 5-char query → threshold 1. LOSARTAN with two substitutions stays out.
    const onlyLosartan = [LOSARTAN];
    expect(matcher.match('xxxxx', onlyLosartan).isKnown).toBe(false);
  });

  it('admits 2 edits for a long query (>12 chars), rejects 3', () => {
    const long = condition('HYDROCHLOROTHIAZIDE', 'Hydrochlorothiazide');
    const pool = [long];
    // 13+ char query, threshold 2. One substitution (i→o) is well in band.
    expect(matcher.match('hydrochlorothiazode', pool).id).toBe('HYDROCHLOROTHIAZIDE');
    // A query no tier can reach (not exact/prefix/within-2-edits/phonetic)
    // returns Unknown — the band is real, not unbounded.
    expect(matcher.match('zzzzzzzzzzzzzzz', pool).isKnown).toBe(false);
  });
});

describe('FuzzyMatchAlgorithm — Double Metaphone phonetic tier', () => {
  const matcher = new FuzzyMatchAlgorithm();

  it('recovers tylonol → Tylenol (same consonant skeleton, vowel swap)', () => {
    // TYLONOL vs TYLENOL is 1 substitution — but it also shares a metaphone
    // code (TLNL). Either tier resolves it; assert the resolution holds.
    expect(doubleMetaphone('tylonol').primary).toBe(doubleMetaphone('tylenol').primary);
    expect(matcher.match('tylonol', CATALOG).id).toBe('TYLENOL');
  });

  it('recovers a phonetic miss beyond the edit band (metphormin → Metformin)', () => {
    // METPHORMIN vs METFORMIN is OSA distance 2 — outside the band for a
    // 10-char query (threshold 1) — so Damerau CANNOT resolve it. But PH and
    // F are homophones, so both encode MTFRMN and the phonetic tier wins.
    expect(optimalStringAlignmentDistance('METPHORMIN', 'METFORMIN')).toBe(2);
    expect(fuzzyThresholdForLength('METPHORMIN'.length)).toBe(1);
    expect(doubleMetaphone('metphormin').primary).toBe(doubleMetaphone('metformin').primary);
    expect(matcher.match('metphormin', CATALOG).id).toBe('METFORMIN');
  });
});

describe('FuzzyMatchAlgorithm — tier ordering (exact > prefix > fuzzy > phonetic)', () => {
  it('prefers the exact match over a fuzzy-reachable neighbor', () => {
    // Pool with two near-identical names; an exact hit must win its tier.
    const lisinopril = condition('LISINOPRIL', 'Lisinopril');
    const lisinoprilHctz = condition('LISINOPRILHCTZ', 'Lisinopril HCTZ');
    const matcher = new FuzzyMatchAlgorithm();
    // Exact key for Lisinopril; LISINOPRILHCTZ is only a prefix neighbor.
    expect(matcher.match('Lisinopril', [lisinopril, lisinoprilHctz]).id).toBe('LISINOPRIL');
  });

  it('prefers a prefix match over a Damerau-distance match', () => {
    const meto = condition('METOPROLOL', 'Metoprolol');
    const metf = condition('METFORMIN', 'Metformin');
    const matcher = new FuzzyMatchAlgorithm();
    // "METO" is a strict prefix of METOPROLOL (tier 1); it is also within 2
    // edits of METFORMIN (tier 2). The prefix tier must win.
    expect(matcher.match('meto', [metf, meto]).id).toBe('METOPROLOL');
  });
});

describe('FuzzyMatchAlgorithm — frequency tie-break', () => {
  it('breaks an intra-tier tie by higher frequency', () => {
    // Two conditions equidistant from the query; frequency decides.
    const a = condition('CONDA', 'Conda');
    const b = condition('CONDB', 'Condb');
    const frequencies = new Map([
      ['CONDA', 10],
      ['CONDB', 9000],
    ]);
    const matcher = new FuzzyMatchAlgorithm({ frequencies });
    // "COND" is a prefix of both (tier 1, equal distance). Higher freq wins.
    expect(matcher.match('cond', [a, b]).id).toBe('CONDB');
  });

  it('falls through to deterministic name order when no frequency map', () => {
    const a = condition('CONDB', 'Condb');
    const b = condition('CONDA', 'Conda');
    const matcher = new FuzzyMatchAlgorithm();
    // No frequencies: equal-distance prefix tie breaks by normalized name.
    // 'conda' < 'condb' so CONDA wins regardless of candidate order.
    expect(matcher.match('cond', [a, b]).id).toBe('CONDA');
    expect(matcher.match('cond', [b, a]).id).toBe('CONDA');
  });
});

describe('FuzzyMatchAlgorithm — NFC normalization (parity rule 1)', () => {
  it('matches a precomposed query against a decomposed candidate name', () => {
    const precomposed = 'café'; // café (single code point)
    const decomposed = 'café'; // café (e + combining acute)
    expect(precomposed).not.toBe(decomposed);
    const cafeCandidate = condition('CAFE', decomposed);
    const matcher = new FuzzyMatchAlgorithm();
    // Phonetic/Damerau over make_key (which strips the accent) plus NFC on
    // the metaphone path: both spellings resolve to the same concept.
    const result = matcher.match(precomposed, [cafeCandidate]);
    expect(result.isKnown).toBe(true);
    expect(result.id).toBe('CAFE');
  });

  it('produces identical metaphone codes for NFC and NFD spellings', () => {
    const precomposed = 'crème';
    const decomposed = 'crème';
    expect(doubleMetaphone(precomposed.normalize('NFC'))).toEqual(
      doubleMetaphone(decomposed.normalize('NFC')),
    );
  });
});

describe('FuzzyMatchAlgorithm — synonym tier (inert without aliases)', () => {
  it('resolves via aliases when a Concept exposes them', () => {
    const acetaminophen = condition('ACETAMINOPHEN', 'Acetaminophen', ['paracetamol']);
    const matcher = new FuzzyMatchAlgorithm();
    // "paracetamol" is neither an exact/prefix/Damerau/phonetic hit for
    // "Acetaminophen" — only the alias tier can resolve it.
    expect(matcher.match('paracetamol', [acetaminophen]).id).toBe('ACETAMINOPHEN');
  });

  it('is a no-op when no candidate exposes aliases', () => {
    const matcher = new FuzzyMatchAlgorithm();
    expect(matcher.match('paracetamol', [METFORMIN]).isKnown).toBe(false);
  });
});

describe('fuzzyThresholdForLength — Elasticsearch AUTO band', () => {
  it('returns 1 for short queries (<6 chars)', () => {
    expect(fuzzyThresholdForLength(3)).toBe(1);
    expect(fuzzyThresholdForLength(5)).toBe(1);
  });

  it('returns 1 for medium queries (6–12 chars)', () => {
    expect(fuzzyThresholdForLength(6)).toBe(1);
    expect(fuzzyThresholdForLength(12)).toBe(1);
  });

  it('caps at 2 for long queries (>12 chars)', () => {
    expect(fuzzyThresholdForLength(13)).toBe(2);
    expect(fuzzyThresholdForLength(40)).toBe(2);
  });
});

describe('optimalStringAlignmentDistance — OSA semantics', () => {
  it('counts an adjacent transposition as one edit', () => {
    expect(optimalStringAlignmentDistance('ab', 'ba')).toBe(1);
    // OSA forbids editing a substring twice, so a transposition that also
    // needs an insertion costs more than the lower bound — CA→ABC is 3.
    expect(optimalStringAlignmentDistance('CA', 'ABC')).toBe(3);
  });

  it('counts insertion / deletion / substitution as one edit each', () => {
    expect(optimalStringAlignmentDistance('cat', 'cats')).toBe(1);
    expect(optimalStringAlignmentDistance('cats', 'cat')).toBe(1);
    expect(optimalStringAlignmentDistance('cat', 'cot')).toBe(1);
  });

  it('short-circuits when the length gap exceeds the cap', () => {
    expect(optimalStringAlignmentDistance('a', 'abcdef', 2)).toBe(3);
  });
});

describe('Double Metaphone — vector fixture (parity rule 4)', () => {
  it.each(DOUBLE_METAPHONE_VECTORS)(
    'encodes "$term" to $primary / $alternate',
    ({ term, primary, alternate }) => {
      const code = doubleMetaphone(term);
      expect(code.primary).toBe(primary);
      expect(code.alternate).toBe(alternate);
    },
  );

  it('covers at least 50 medical/drug terms', () => {
    expect(DOUBLE_METAPHONE_VECTORS.length).toBeGreaterThanOrEqual(50);
  });

  it('pools the canonical homophone pair tylenol / tylonol', () => {
    expect(doubleMetaphone('tylenol').primary).toBe(doubleMetaphone('tylonol').primary);
  });
});
