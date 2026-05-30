/**
 * Typed value objects for `POST /v3/prequalify` and `POST /v3/quote`.
 * The v3 contract collapses v2's `premium` + `other_offers` split into
 * one uniform `pricing[]` table per product. Money is always integer
 * cents paired with a server-formatted `display` string; there is no
 * string-money path anywhere.
 *
 * Shape over helpers: consumers iterate `offer.pricing` directly,
 * filter rows on `row.eligibility.eligible`, and trust array order for
 * display. There are no synthetic indexes, no client-side sort keys.
 */
import type { Applicant } from './applicant';
import type { CoverageInput } from './coverage';
import type { ProductSelection, ProductClassValue } from './product';
import type { AuthContext } from './auth';
import type { Transport } from './transport';
import type { Clock } from '../core';
import type { OfferCarrier, OfferProduct, OfferPlanInfo } from './prequalify-v2-types';
/**
 * Underwriting rank bucket. `null` reserved for the unlikely case the
 * server cannot resolve any bucket; closed enum otherwise. This is NOT
 * the carrier rate-class label — that lives on `V3PricingRow.rateClass`.
 */
export type V3EligibilityCategory = 'immediate' | 'graded' | 'rop' | 'other' | null;
/** Eligibility for one row of the pricing table. */
export interface V3Eligibility {
    /** Underwriting rank bucket (closed enum), `null` when unresolved. */
    readonly category: V3EligibilityCategory;
    /** True when the applicant qualifies at this row. */
    readonly eligible: boolean;
    /**
     * Generic, carrier-confidential reasons populated when `eligible` is
     * false. Empty array when `eligible` is true. Per-tier specificity is
     * intentionally not surfaced.
     */
    readonly reasons: readonly string[];
}
/** A money value in integer minor units paired with display string. */
export interface V3Money {
    readonly cents: number;
    readonly display: string;
}
/** Premium for one row of the pricing table. */
export interface V3Premium {
    /** Premium for the default mode in integer cents. */
    readonly cents: number;
    /** Server-formatted display string for the default mode. */
    readonly display: string;
    /**
     * The premium at the carrier's default pricing mode, as a self-
     * contained `{cents, display}` pair. ALWAYS present. This is the
     * apples-to-apples comparison value.
     */
    readonly default: V3Money;
    /** Full grid of carrier modes (`MONTHLY-EFT`, `ANNUAL`, ...). */
    readonly modes: Readonly<Record<string, V3Money>>;
}
/**
 * One row of the uniform pricing table — a single rate class for one
 * product. Replaces v2's `premium` + `other_offers` split: the best
 * qualifying class and every alternate (qualifying or not) are sibling
 * rows distinguished by `primary` and their own `eligibility`.
 */
export interface V3PricingRow {
    /** Carrier-defined rate class verbatim. */
    readonly rateClass: string;
    /** True for the single best qualifying row per product. */
    readonly primary: boolean;
    /** Eligibility for this row. */
    readonly eligibility: V3Eligibility;
    /** Premium for this row. `undefined` when `eligibility.eligible` is false. */
    readonly premium?: V3Premium;
    /** Server-assigned display rank for this row; `null` when ineligible. */
    readonly rank: number | null;
}
/** Death benefit for a v3 offer. */
export type V3DeathBenefit = V3Money;
/**
 * One product's v3 prequalification result. Array order of `pricing`
 * is authoritative for display — there is no `result_index`, no
 * client-side sort key, no synthetic rank.
 */
export interface PrequalifyV3Offer {
    readonly object: 'plan_offer';
    /** Stable UUID v5 from `(carrier_slug, product_slug)`. */
    readonly id: string;
    /**
     * True when the applicant qualifies for at least one rate class on
     * this product. Convenience field — equivalent to
     * `offer.pricing.some(row => row.eligibility.eligible)`.
     */
    readonly eligible: boolean;
    readonly carrier: OfferCarrier;
    readonly product: OfferProduct;
    readonly planInfo: OfferPlanInfo;
    readonly deathBenefit: V3DeathBenefit;
    /**
     * One row per rate class for this product. Array order is
     * authoritative for display; exactly one row has `primary: true`
     * when the product has any qualifying class.
     */
    readonly pricing: readonly V3PricingRow[];
    readonly metadata: Readonly<Record<string, unknown>>;
}
/** Payload of the `data` field on the v3 prequalify envelope. */
export interface PrequalifyV3Result {
    readonly plans: readonly PrequalifyV3Offer[];
    /** Echoed envelope metadata. */
    readonly requestId: string;
    /** Echoed envelope metadata. */
    readonly idempotencyKey: string;
    readonly livemode: boolean;
    readonly retryAttempts: number;
}
/** Options layered on top of the v3 prequalify request. */
export interface PrequalifyV3Options {
    readonly onlyProductClass?: ProductClassValue;
    readonly includeProductClass?: readonly ProductClassValue[];
    readonly minRank?: string;
    readonly showUnreleased?: boolean;
    readonly skipHealthBasedUnderwriting?: boolean;
    /**
     * Default `true`. When `true`, products and rate-class rows the
     * applicant does not qualify for surface with `eligible: false`.
     */
    readonly includeIneligible?: boolean;
}
/** Inputs accepted by `prequalifyV3`. */
export interface PrequalifyV3Request {
    readonly applicant: Applicant;
    readonly coverage: CoverageInput;
    readonly products: ProductSelection;
    readonly options?: PrequalifyV3Options;
}
/** Per-call context for `prequalifyV3`. */
export interface PrequalifyV3Context {
    readonly baseUrl: string;
    readonly auth: AuthContext;
    readonly transport: Transport;
    readonly clock: Clock;
    readonly idempotencyKey?: string;
}
/** One product within a quote amount group. */
export interface QuoteV3Product {
    readonly object: 'plan_offer';
    readonly id: string;
    readonly eligible: boolean;
    readonly carrier: OfferCarrier;
    readonly product: OfferProduct;
    readonly deathBenefit: V3DeathBenefit;
    readonly pricing: readonly V3PricingRow[];
}
/** All qualifying products for one requested amount. */
export interface QuoteV3Group {
    /** The requested amount this group answers, as a string. */
    readonly amount: string;
    readonly products: readonly QuoteV3Product[];
}
/** Payload of the `data` field on the v3 quote envelope. */
export interface QuoteV3Result {
    readonly results: readonly QuoteV3Group[];
    readonly requestId: string;
    readonly idempotencyKey: string;
    readonly livemode: boolean;
    readonly retryAttempts: number;
}
/** Options for `quoteV3`. Same shape as the prequalify options. */
export type QuoteV3Options = PrequalifyV3Options;
/** Inputs accepted by `quoteV3`. */
export interface QuoteV3Request {
    readonly applicant: Applicant;
    readonly coverage: CoverageInput;
    readonly products: ProductSelection;
    readonly options?: QuoteV3Options;
}
/** Per-call context for `quoteV3`. */
export type QuoteV3Context = PrequalifyV3Context;
//# sourceMappingURL=prequalify-v3-types.d.ts.map