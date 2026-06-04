/**
 * MinRank value-set tests.
 *
 * Covers the canonical identifier → wire-token mapping and the synonym
 * collapse (`ReturnOfPremium` → `rop`, `GuaranteedIssue`/`Gi` → `guaranteed`).
 */

import { describe, expect, it } from 'vitest';
import { MinRank, type MinRankValue } from '../../src/zyins/minRank';

describe('MinRank', () => {
  it('maps canonical identifiers to lowercase wire tokens', () => {
    expect(MinRank.Immediate).toBe('immediate');
    expect(MinRank.Graded).toBe('graded');
    expect(MinRank.Rop).toBe('rop');
    expect(MinRank.Guaranteed).toBe('guaranteed');
  });

  it('collapses synonyms onto their canonical wire token', () => {
    expect(MinRank.ReturnOfPremium).toBe('rop');
    expect(MinRank.GuaranteedIssue).toBe('guaranteed');
    expect(MinRank.Gi).toBe('guaranteed');
  });

  it('synonyms are byte-identical to their canonical member', () => {
    expect(MinRank.ReturnOfPremium).toBe(MinRank.Rop);
    expect(MinRank.GuaranteedIssue).toBe(MinRank.Guaranteed);
    expect(MinRank.Gi).toBe(MinRank.Guaranteed);
  });

  it('exposes exactly the four lowercase wire tokens as values', () => {
    const tokens: MinRankValue[] = ['immediate', 'graded', 'rop', 'guaranteed'];
    expect(new Set(Object.values(MinRank))).toEqual(new Set(tokens));
  });
});
