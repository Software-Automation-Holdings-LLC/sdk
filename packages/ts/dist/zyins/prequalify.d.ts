/**
 * Tier 3 prequalify operation.
 *
 * Replaces the inline payload assembly in bpp2.0's `analyzeCase`
 * (`src/lib/data.js:1315`). The before-state spreads HTTP, header, license,
 * and serialization concerns across the call site; this module isolates
 * them.
 *
 * Inputs: a typed `PrequalifyRequest` (applicant, coverage, products).
 * Output: a typed `PrequalifyResult` (plans, ranking, declines).
 *
 * Locked invariants (per ADR-035):
 *  - The wire body is built by the SDK; the call site never sees it.
 *  - The idempotency key is derived from sessionId:op:body-hash.
 *  - Errors are typed; ERR_* strings and ProblemDetails JSON both funnel
 *    through `fromHttpResponse`.
 */
import { type Applicant } from './applicant';
import { type Coverage } from './coverage';
import { type ProductSelection } from './product';
import { type AuthContext } from './auth';
import { type Transport } from './transport';
import { type Clock } from '../core';
/** Inputs accepted by `prequalify`. */
export interface PrequalifyRequest {
    applicant: Applicant;
    coverage: Coverage;
    products: ProductSelection;
}
/** Inputs accepted by `prequalifyLegacyBlob`. */
export interface PrequalifyLegacyBlobRequest {
    /**
     * The pre-encoded prequalify payload produced by a legacy caller's own
     * encoder (e.g. bpp2.0's `prepEncObj` / `prepEncObjV2`). Serialized to
     * JSON verbatim and sent as the request body.
     */
    encodedPayload: Record<string, unknown>;
}
/** One plan returned by the engine. */
export interface PrequalifyPlan {
    /** Carrier brand (e.g., "colonial-penn"). */
    brand: string;
    /** Plan tier within the carrier (e.g., "preferred-plus"). */
    tier: string;
    /** Monthly premium in USD (the bucketed amount the engine quoted). */
    monthlyPremium: number;
    /** Face value the premium applies to, in whole US dollars. */
    faceValue: number;
    /** Underlying product wire token; useful for routing into eApp. */
    productToken: string;
}
/** Output of `prequalify`. */
export interface PrequalifyResult {
    /** Plans the applicant qualified for, ordered as the engine returns them. */
    plans: ReadonlyArray<PrequalifyPlan>;
    /** Engine request id for correlation with server-side logs. */
    requestId: string;
    /** Idempotency key sent on the wire request. Propagated into the Envelope
     *  so callers can round-trip the key without parsing raw headers. */
    idempotencyKey: string;
}
/** Shared knobs the client passes through to the prequalify call. */
export interface PrequalifyContext {
    baseUrl: string;
    auth: AuthContext;
    transport: Transport;
    clock: Clock;
    /** Optional override; defaults to the derived key (`deriveIdempotencyKey`). */
    idempotencyKey?: string;
}
/**
 * Run a prequalify call. Builds the wire body, derives the idempotency key,
 * signs the request, and parses the response into typed plans.
 */
export declare function prequalify(request: PrequalifyRequest, ctx: PrequalifyContext): Promise<PrequalifyResult>;
/**
 * Run a prequalify call from a pre-encoded payload. Same path, same
 * headers, same response shape as the typed `prequalify`.
 */
export declare function prequalifyLegacyBlob(request: PrequalifyLegacyBlobRequest, ctx: PrequalifyContext): Promise<PrequalifyResult>;
//# sourceMappingURL=prequalify.d.ts.map