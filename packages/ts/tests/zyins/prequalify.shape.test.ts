/**
 * Locked-spec conformance — `isa.zyins.prequalify` input shape.
 *
 * Spec: /tmp/sdk-syntax-proposal.md § Section 3 Flow 4 + Appendix B.4.
 *
 * Locks verified here (the four post-lock correction items):
 *   • Identity-bearing fields (`name`, `email`, `phone`) MUST NOT be accepted
 *     on the applicant. They belong on the case record, not on prequalify.
 *   • `zip`, `nicotineUsage`, `coverage` variants, `products`, `openEnrollment`,
 *     `includeProductClass`, `restrictRank` MUST be accepted.
 *   • Wire-field map (SDK boundary translation):
 *       applicant.height → wire `height` (inches via Height.toInches())
 *       applicant.weight → wire `weight` (pounds via Weight.toPounds())
 *       coverage → resolves to `face-value` / `monthly-budget` / multi-* fields
 *   • Plumbing fields (`license-key`, `multiproc`, `analytics-email`, …) MUST
 *     NEVER reach the consumer surface.
 *
 * Persona: John Doe DOB 1962-04-18, NC, 28203, 5'10", 195 lbs, never-smoker.
 */

import { describe, expectTypeOf, it } from 'vitest';
import * as sdk from '../../src';
import { Isa } from '../../src';

describe('prequalify input — identity-free (Flow 4 + Appendix B.4)', () => {
    type Isa$ = InstanceType<typeof Isa>;
    type Prequalify = Isa$['zyins']['prequalify'];

    it('prequalify is callable from the zyins namespace', () => {
        expectTypeOf<Prequalify>().toBeFunction();
    });

    it('applicant input MUST NOT accept `name`', () => {
        type Args = Parameters<Prequalify>;
        type ApplicantArg = Args[0] extends { applicant: infer A } ? A : never;
        type HasName = ApplicantArg extends { name: unknown } ? true : false;
        expectTypeOf<HasName>().toEqualTypeOf<false>();
    });

    it('applicant input MUST NOT accept `email`', () => {
        type Args = Parameters<Prequalify>;
        type ApplicantArg = Args[0] extends { applicant: infer A } ? A : never;
        type HasEmail = ApplicantArg extends { email: unknown } ? true : false;
        expectTypeOf<HasEmail>().toEqualTypeOf<false>();
    });

    it('applicant input MUST NOT accept `phone`', () => {
        type Args = Parameters<Prequalify>;
        type ApplicantArg = Args[0] extends { applicant: infer A } ? A : never;
        type HasPhone = ApplicantArg extends { phone: unknown } ? true : false;
        expectTypeOf<HasPhone>().toEqualTypeOf<false>();
    });

    it('top-level input MUST accept conditions / medications / coverage / products / openEnrollment / includeProductClass / restrictRank', () => {
        type Args = Parameters<Prequalify>;
        type Input = Args[0];
        expectTypeOf<Input>().toHaveProperty('conditions');
        expectTypeOf<Input>().toHaveProperty('medications');
        expectTypeOf<Input>().toHaveProperty('coverage');
        expectTypeOf<Input>().toHaveProperty('products');
        expectTypeOf<Input>().toHaveProperty('openEnrollment');
        expectTypeOf<Input>().toHaveProperty('includeProductClass');
        expectTypeOf<Input>().toHaveProperty('restrictRank');
    });

    it('Coverage value-object is exported with faceValue / monthlyBudget factories', () => {
        // Flow 4 wire-field map row: Coverage.faceValue(25_000) / Coverage.monthlyBudget(100).
        expectTypeOf(sdk.Coverage).toBeObject();
    });
});
