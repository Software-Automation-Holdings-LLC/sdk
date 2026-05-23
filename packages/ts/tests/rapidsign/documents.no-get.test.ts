/**
 * Locked-spec conformance — `isa.rapidsign.documents.get` is NOT exported.
 *
 * Spec: /tmp/sdk-syntax-proposal.md § Section 4 cross-cutting + Appendix B.5.
 *
 *   "There is no `isa.rapidsign.documents.get(id)` method — the wire has
 *    no `GET /documents/{id}` endpoint backing it. Document state is held
 *    by the `doc` reference returned from `.create()`. For persisted-
 *    across-page-load state, use `isa.recovery.*` (Flow F)."
 *
 * Build-time guarantee that nothing reintroduces a `documents.get` verb.
 */

import { describe, expectTypeOf, it } from 'vitest';
import { Isa } from '../../src';

describe('documents.get is intentionally absent (Appendix B.5)', () => {
    type Isa$ = InstanceType<typeof Isa>;
    type RapidSign = Isa$['rapidsign'];
    type Documents = RapidSign extends { documents: infer D } ? D : never;

    it('rapidsign.documents has no `get` member', () => {
        // TODO: green after feat/sdk-locked-syntax lands — current shim may still expose .get.
        type HasGet = Documents extends { get: unknown } ? true : false;
        expectTypeOf<HasGet>().toEqualTypeOf<false>();
    });
});
