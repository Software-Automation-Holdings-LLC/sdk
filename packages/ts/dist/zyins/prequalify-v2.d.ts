/**
 * Tier 3 prequalify v2 operation — `POST /v2/prequalify`.
 *
 * v2 returns the modern envelope shape with one `PlanOffer` per product;
 * each entry carries the **best qualifying** category at the top level and
 * alternate categories nested in `other_offers[]`. Ineligible products /
 * tiers surface only when `include_ineligible: true`.
 *
 * Locked invariants (mirroring v1):
 *   - The wire body is built by the SDK; the call site never sees it.
 *   - The idempotency key is derived from sessionId:op:body-hash unless
 *     overridden via `ctx.idempotencyKey`.
 *   - Auth credentials live in HMAC headers only — never in the body.
 *
 * Typed value objects live in `prequalify-v2-types.ts`; this file owns the
 * wire serialization, header building, and response parsing.
 */
import { type PrequalifyV2Context, type PrequalifyV2Request, type PrequalifyV2Result } from './prequalify-v2-types.js';
export type { OfferCarrier, OfferCategory, OfferEligibility, OfferMoney, OfferPlanInfo, OfferPlanInfoItem, OfferPlanInfoLegacy, OfferPremium, OfferProduct, OtherOffer, PlanOffer, PrequalifyV2Context, PrequalifyV2Request, PrequalifyV2Result, } from './prequalify-v2-types.js';
export type { OfferDeathBenefit, PrequalifyV2Options, } from './prequalify-v2-types.js';
/**
 * Run a v2 prequalify call. Builds the wire body, derives the idempotency
 * key, signs the request, and parses the envelope into typed offers.
 */
export declare function prequalifyV2(request: PrequalifyV2Request, ctx: PrequalifyV2Context): Promise<PrequalifyV2Result>;
//# sourceMappingURL=prequalify-v2.d.ts.map