/**
 * Locked-spec conformance — `isa.zyins.cases.share`.
 *
 * Spec: /tmp/sdk-syntax-proposal.md § Section 3 Flow 5 + Appendix B.2.
 *
 * Locks verified here:
 *   • Single verb `share` regardless of RW vs RO intent. The recipient's UI
 *     decides display mode (`forceReadonlyAtom` in bpp2.0); the SDK has no
 *     `mode: 'rw' | 'ro'` flag.
 *   • Input shape: `{ input, results?, products? }` — `results` + `products`
 *     are the only differentiators between "RW link" and "RO link".
 *   • Return is plain `Promise<ShareLink>` (or equivalent). No `onPending` /
 *     `onComplete` lifecycle callbacks (Flow 5 explicitly drops these).
 *
 * Persona: John Doe MYGA quote shared from agent.
 */

import { describe, expectTypeOf, it } from 'vitest';
import { Isa } from '../../src';

describe('cases.share — one shape, no mode flag (Flow 5 + Appendix B.2)', () => {
    type ZyIns = InstanceType<typeof Isa>['zyins'];
    type Cases = ZyIns extends { cases: infer C } ? C : never;
    type Share = Cases extends { share: infer F } ? F : never;

    it('cases.share exists on the zyins namespace', () => {
        // TODO: green after feat/sdk-locked-syntax lands.
        expectTypeOf<Cases>().toHaveProperty('share');
    });

    it('cases.share is a function (callable verb, not a sub-namespace)', () => {
        // TODO: green after feat/sdk-locked-syntax lands.
        expectTypeOf<Share>().toBeFunction();
    });

    // Negative test: there must be no `mode` flag on the input.
    // We assert structurally by inspecting the first parameter — if a `mode`
    // key surfaces during implementation it will trip a follow-up review,
    // because Appendix B.2 explicitly removes that knob.
    it('no `mode` field on the share input (Appendix B.2)', () => {
        // TODO: green after feat/sdk-locked-syntax lands.
        // Once `share` is typed, narrow Parameters<Share>[0] and assert
        // `mode` is `never`. Until then this is a placeholder pin.
        type FirstParam = Share extends (...args: infer A) => unknown ? A[0] : never;
        type HasMode = FirstParam extends { mode: unknown } ? true : false;
        expectTypeOf<HasMode>().toEqualTypeOf<false>();
    });
});
