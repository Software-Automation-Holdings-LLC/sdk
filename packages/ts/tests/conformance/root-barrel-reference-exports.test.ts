/**
 * Root-barrel reference exports — B1 ship-blocker regression guard.
 *
 * `ReferenceSort` and the reference concept/adapter types must be
 * importable from the PACKAGE ROOT (`@software-automation-holdings-llc/sdk`),
 * not just the `./zyins` sub-barrel. Before this guard, a consumer
 * (bpp2.0) importing `ReferenceSort` from the root got `undefined` and
 * had to maintain a local enum shim.
 *
 * Both the runtime value (the frozen `Sort` enum) and the type surface
 * are pinned here so a future barrel edit that drops either fails loudly.
 */

import { describe, expect, expectTypeOf, it } from 'vitest';
import { FuzzyMatchAlgorithm, ReferenceSort } from '../../src';
import type {
    AutocompleteOptions,
    Concept,
    DatasetBundleV3,
    FuzzyMatchAlgorithmOptions,
    MatchAlgorithm,
    ReferenceAdapters,
} from '../../src';

describe('root barrel re-exports the reference surface (B1)', () => {
    it('ReferenceSort is a defined runtime value with both sort members', () => {
        expect(ReferenceSort).toBeDefined();
        expect(ReferenceSort.MostCommonFirst).toBe('most_common_first');
        expect(ReferenceSort.Alphabetical).toBe('alphabetical');
    });

    it('ReferenceSort is frozen — consumers cannot mutate the public enum', () => {
        expect(Object.isFrozen(ReferenceSort)).toBe(true);
    });

    it('reference types resolve from the package root', () => {
        expectTypeOf<Concept>().not.toBeAny();
        expectTypeOf<DatasetBundleV3>().not.toBeAny();
        expectTypeOf<ReferenceAdapters>().not.toBeAny();
        expectTypeOf<AutocompleteOptions>().toHaveProperty('sort');
        expectTypeOf<FuzzyMatchAlgorithmOptions>().not.toBeAny();
    });

    it('FuzzyMatchAlgorithm is constructible from the root and satisfies MatchAlgorithm', () => {
        const matcher = new FuzzyMatchAlgorithm();
        expect(matcher).toBeInstanceOf(FuzzyMatchAlgorithm);
        // The opt-in matcher is a drop-in for the adapter slot.
        expectTypeOf<FuzzyMatchAlgorithm>().toMatchTypeOf<MatchAlgorithm>();
        // Never rejects: an empty candidate pool yields an Unknown handle.
        const result = matcher.match('lisinopril', []);
        expect(result.isKnown).toBe(false);
        expect(result.inputText).toBe('lisinopril');
    });
});
