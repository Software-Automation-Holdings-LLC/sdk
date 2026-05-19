import { describe, expect, it } from 'vitest';
import {
  deobfuscate,
  isObfuscated,
  LEGACY_FUSC_KEY,
  obfuscate,
} from '../../src/core/obfuscation';
import fixtures from './fixtures.json';

/**
 * Fixtures captured from the original `_fusc` in
 * eapp-system/resources/js/lib/secure-validation-library.js. Existing
 * cached values in users' browsers were encoded with exactly these bytes;
 * drift here breaks the storage layer.
 */
const obfuscationVectors = fixtures.obfuscationFixtures as ReadonlyArray<{
  input: string;
  obfuscated: string;
  isObfuscated: boolean;
  isObfuscatedOriginal: boolean;
}>;

describe('obfuscation', () => {
  describe('obfuscate (default legacy key)', () => {
    it.each(obfuscationVectors)(
      'matches the legacy _fusc output byte-for-byte for fixture %#',
      ({ input, obfuscated }) => {
        expect(obfuscate(input)).toBe(obfuscated);
      },
    );

    it('is its own inverse (XOR property)', () => {
      const samples = ['', 'a', 'Hello', 'café 🎉'];
      for (const s of samples) {
        expect(obfuscate(obfuscate(s))).toBe(s);
      }
    });
  });

  describe('deobfuscate', () => {
    it.each(obfuscationVectors)(
      'recovers the original input from the legacy-obfuscated form for fixture %#',
      ({ input, obfuscated }) => {
        expect(deobfuscate(obfuscated)).toBe(input);
      },
    );
  });

  describe('custom key', () => {
    it('cycles a multi-byte key over the input', () => {
      const input = 'ABCDEF';
      const key = 'XY';
      const out = obfuscate(input, key);
      expect(out.length).toBe(input.length);
      expect(deobfuscate(out, key)).toBe(input);
    });

    it('throws on empty key', () => {
      expect(() => obfuscate('x', '')).toThrow(/non-empty/);
    });
  });

  describe('edge cases', () => {
    it('returns empty string for empty input', () => {
      expect(obfuscate('')).toBe('');
      expect(deobfuscate('')).toBe('');
    });

    it('handles single char', () => {
      expect(deobfuscate(obfuscate('x'))).toBe('x');
    });

    it('handles long string (10KB)', () => {
      const long = 'abc'.repeat(3500);
      expect(deobfuscate(obfuscate(long))).toBe(long);
    });

    it('handles unicode and special chars', () => {
      const s = 'café 日本語 🎉 \t\n!@#$%^&*()';
      expect(deobfuscate(obfuscate(s))).toBe(s);
    });
  });

  describe('isObfuscated', () => {
    it.each(obfuscationVectors)(
      'returns the same verdict as the legacy _checkObfuscation for fixture %#',
      ({ obfuscated, isObfuscated: expectedForObfuscated, input, isObfuscatedOriginal }) => {
        expect(isObfuscated(obfuscated)).toBe(expectedForObfuscated);
        expect(isObfuscated(input)).toBe(isObfuscatedOriginal);
      },
    );

    it('returns false for empty input', () => {
      expect(isObfuscated('')).toBe(false);
    });

    it('invariant: isObfuscated(obfuscate(s)) is true for non-trivial ASCII with legacy key', () => {
      const samples = [
        'Hello, World!',
        'pk_live_01HXYZABC123',
        'the quick brown fox',
        '{"k":"v"}',
      ];
      for (const s of samples) {
        expect(isObfuscated(obfuscate(s))).toBe(true);
      }
    });
  });

  describe('LEGACY_FUSC_KEY', () => {
    it('is the single byte 0xAA', () => {
      expect(LEGACY_FUSC_KEY).toHaveLength(1);
      expect(LEGACY_FUSC_KEY.charCodeAt(0)).toBe(0xaa);
    });
  });
});
