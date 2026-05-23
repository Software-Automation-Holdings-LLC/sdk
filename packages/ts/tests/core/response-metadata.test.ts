/**
 * Locked-spec conformance — underscore-prefix response metadata.
 *
 * Spec: /tmp/sdk-syntax-proposal.md § Section 2.3 + Appendix B.1.
 *
 *   "Methods return data directly. Request metadata is attached to the
 *    return value via underscore-prefix properties (OpenAI SDK pattern)."
 *
 *   • `result._requestId`        — 'req_01HZK2N5GQR9T8X4B6FJW3Y1AS'
 *   • `result._idempotencyKey`   — '550e8400-e29b-41d4-a716-446655440000'
 *   • NO `.withRawResponse()` dual-call dance is exported.
 *
 * Persona: idempotency-key 550e8400-…, request id req_01HZK2N5….
 */

import { describe, expectTypeOf, it } from 'vitest';
import * as sdk from '../../src';

describe('underscore-prop metadata pattern (Section 2.3 / Appendix B.1)', () => {
    it('no `withRawResponse` symbol on the public surface', () => {
        // Appendix B.1: the wrapper-method dance is replaced by underscore props.
        // The named symbol `withRawResponse` must not be exported.
        type Surface = keyof typeof sdk;
        type HasWithRawResponse = 'withRawResponse' extends Surface ? true : false;
        expectTypeOf<HasWithRawResponse>().toEqualTypeOf<false>();
    });

    // Type contract: every mutating return type should structurally permit
    // `_requestId` and `_idempotencyKey` underscore-prefix props. The full
    // matrix is enforced once the locked surface lands; here we pin the
    // OpenAI-style envelope as the canonical convention.
    it('underscore-prop convention pin', () => {
        type PrequalifyReturn = Awaited<
            ReturnType<InstanceType<typeof sdk.Isa>['zyins']['prequalify']>
        >;
        expectTypeOf<PrequalifyReturn>().toHaveProperty('_requestId');
        expectTypeOf<PrequalifyReturn>().toHaveProperty('_idempotencyKey');
    });
});
