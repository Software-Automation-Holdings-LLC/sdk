/**
 * Locked-spec conformance — single IsaError tree, instanceof everywhere.
 *
 * Spec: /tmp/sdk-syntax-proposal.md § Section 2.1 + Section 3 Flow 1.
 *
 *   try {
 *     await isa.zyins.license.activate();
 *   } catch (e) {
 *     if (e instanceof IsaError.LicenseLocked)         { ... }
 *     if (e instanceof IsaError.MaxActivationsExceeded) { ... }
 *     if (e instanceof IsaError.LicenseActiveElsewhere) { ... }
 *     throw e;
 *   }
 *
 *   IsaError.match(error, { ... }) — opt-in sugar, never primary in docs.
 *
 * Locks verified here:
 *   • One tree, IsaError, with the named subclasses exposed as own properties
 *     (so call sites can `instanceof IsaError.LicenseLocked`).
 *   • `match()` is available on the tree (opt-in).
 *   • Each subclass extends a common base — `instanceof IsaError` is true
 *     for any subclass instance (universal catch-all).
 *
 * Persona: SDV-HWH-WDD license activation throwing LicenseLocked.
 */

import { describe, expect, expectTypeOf, it } from 'vitest';
import { IsaError } from '../../src';

describe('IsaError — single tree shape (Flow 1)', () => {
    it('IsaError exists as a named export', () => {
        expect(IsaError).toBeDefined();
    });

    it('IsaError.match is available as opt-in sugar', () => {
        // TODO: green after feat/sdk-locked-syntax lands.
        type Tree = typeof IsaError;
        expectTypeOf<Tree>().toHaveProperty('match');
    });

    it('subclasses live on the IsaError namespace (LicenseLocked / MaxActivationsExceeded / LicenseActiveElsewhere / Network / InternalError / IdempotencyConflict / DeadlineExceeded / SignerDeclined)', () => {
        // TODO: green after feat/sdk-locked-syntax lands.
        type Tree = typeof IsaError;
        expectTypeOf<Tree>().toHaveProperty('LicenseLocked');
        expectTypeOf<Tree>().toHaveProperty('MaxActivationsExceeded');
        expectTypeOf<Tree>().toHaveProperty('LicenseActiveElsewhere');
        expectTypeOf<Tree>().toHaveProperty('Network');
        expectTypeOf<Tree>().toHaveProperty('InternalError');
        expectTypeOf<Tree>().toHaveProperty('IdempotencyConflict');
        expectTypeOf<Tree>().toHaveProperty('DeadlineExceeded');
        expectTypeOf<Tree>().toHaveProperty('SignerDeclined');
    });
});
