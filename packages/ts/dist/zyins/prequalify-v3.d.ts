/**
 * Tier 3 prequalify v3 operation — `POST /v3/prequalify`.
 *
 * The v3 contract collapses v2's `premium` + `other_offers` into one
 * uniform `pricing[]` table per product (see `prequalify-v3-types.ts`).
 * Money is integer cents + server-formatted `display`; array order is
 * authoritative; there is no `result_index`.
 *
 * Idempotency: every v3 mutating call requires a UUID v4 in
 * `Idempotency-Key`. We auto-mint when the caller does not supply one.
 */
import { type Applicant } from './applicant';
import { type CoverageInput } from './coverage';
import { type AuthContext } from './auth';
import { type Clock } from '../core';
import { type PrequalifyV3Context, type PrequalifyV3Request, type PrequalifyV3Result, type V3PricingRow } from './prequalify-v3-types';
export type { PrequalifyV3Context, PrequalifyV3Offer, PrequalifyV3Options, PrequalifyV3Request, PrequalifyV3Result, QuoteV3Context, QuoteV3Group, QuoteV3Options, QuoteV3Product, QuoteV3Request, QuoteV3Result, V3DeathBenefit, V3Eligibility, V3EligibilityCategory, V3Money, V3Premium, V3PricingRow, } from './prequalify-v3-types';
/**
 * Run a v3 prequalify call. Builds the wire body, mints a UUID v4 for
 * `Idempotency-Key` if the caller did not pass one, signs the request,
 * and parses the envelope into typed offers.
 */
export declare function prequalifyV3(request: PrequalifyV3Request, ctx: PrequalifyV3Context): Promise<PrequalifyV3Result>;
/**
 * Build the `PrequalifyV3Request` wire body — the envelope shape with
 * `applicant`, `coverage`, `products[]` per the OpenAPI spec.
 *
 * v3 prequalify is a face-amount-only evaluation; multi-amount /
 * monthly-budget callers must use `quoteV3`. We collapse multi-amount
 * coverage to its first amount here so a misuse fails loudly server-side
 * rather than silently dropping the others. `face_amount_cents` is
 * integer cents (SDK input dollars × 100, rounded).
 *
 * `applicant.state` is moved into the coverage envelope per the v3
 * schema. `applicant.zip`, `options.minRank`, `options.showUnreleased`,
 * `options.skipHealthBasedUnderwriting`, `options.onlyProductClass`,
 * `options.includeProductClass` are not part of the v3 prequalify
 * envelope and are silently dropped — they survive on `/v3/quote` via
 * the legacy flat body.
 */
export declare function serializeV3PrequalifyBody(request: PrequalifyV3Request): string;
export declare function serializeWireBody(request: {
    readonly applicant: Applicant;
    readonly coverage: CoverageInput;
    readonly products: PrequalifyV3Request['products'];
    readonly options?: PrequalifyV3Request['options'];
}): string;
export declare function buildHeaders(args: {
    readonly auth: AuthContext;
    readonly body: string;
    readonly idempotencyKey: string;
    readonly clock: Clock;
    readonly path: string;
    /**
     * Pinned API version for this call. When set, surfaces as the
     * `Api-Version` request header so the server routes deterministically
     * even if a transport-layer middleware mutates the URL.
     */
    readonly apiVersion?: string;
}): Promise<Record<string, string>>;
export declare function mintUuidV4(): string;
export declare function coercePricingRow(raw: unknown): V3PricingRow;
//# sourceMappingURL=prequalify-v3.d.ts.map