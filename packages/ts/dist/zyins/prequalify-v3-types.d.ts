/**
 * Typed value objects for `POST /v3/prequalify` and `POST /v3/quote`.
 *
 * The v3 contract collapses v2's `premium` + `other_offers` split into
 * one uniform `pricing[]` table per product, and standardizes every
 * monetary value on the {@link V3Money} primitive: an integer-cents
 * {@link V3Amount} paired with a recurrence {@link V3Period}. There is no
 * string-money path anywhere.
 *
 * Both endpoints answer one flat `plans[]` array — single amount and
 * multi-amount alike. Grouping by the requested coverage dimension is
 * client-side: {@link byAmount} keys face-amount offers off
 * `deathBenefit.amount.cents` and monthly-budget offers off
 * `budget.amount.cents`.
 */
import type { Applicant } from './applicant.js';
import type { CoverageInput } from './coverage.js';
import type { ProductSelection, ProductClassValue } from './product.js';
import type { AuthContext } from './auth.js';
import type { Transport } from './transport.js';
import type { Clock } from '../core/index.js';
import type { OfferCarrier, OfferProduct, OfferPlanInfo } from './prequalify-v2-types.js';
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
/**
 * A monetary amount in integer minor units (US cents) paired with the
 * server-formatted display string (the OpenAPI `AmountResponse`). `cents`
 * is canonical for arithmetic and comparison; `display` is rendered
 * verbatim and never parsed.
 */
export interface V3Amount {
    readonly cents: number;
    readonly display: string;
}
/**
 * Recurrence period for a {@link V3Money}. `null` is a one-time / lump-sum
 * amount (a death benefit); the named values are premium billing cycles.
 */
export type V3Period = 'monthly' | 'quarterly' | 'semiannual' | 'annual' | null;
/**
 * A monetary value with a recurrence period (the OpenAPI `Money`). Used
 * for `deathBenefit` (`period: null`, a one-time lump sum) and `budget`
 * (`period: "monthly"`, the requested monthly budget). `amount` is the
 * canonical {@link V3Amount}; `period` disambiguates one-time vs recurring.
 */
export interface V3Money {
    readonly amount: V3Amount;
    readonly period: V3Period;
}
/**
 * Premium for one row of the pricing table.
 *
 * `amount` is the headline value clients compare across carriers; it is
 * byte-identical to `modes[defaultMode]`. `defaultMode` names which `modes`
 * entry `amount` was drawn from — the carrier mode token (`MONTHLY-EFT`,
 * `ANNUAL`, …) which itself encodes the recurrence, so premium carries no
 * `period` field. Read `amount` directly, or index `modes` by `defaultMode`
 * for the same value plus the rest of the grid.
 */
export interface V3Premium {
    /**
     * The headline premium clients compare across carriers, as a self-
     * contained {@link V3Amount}. ALWAYS byte-identical to
     * `modes[defaultMode]`. Premium carries no `period` — the carrier mode
     * token in {@link defaultMode} already encodes the recurrence.
     */
    readonly amount: V3Amount;
    /**
     * The `modes` key naming which carrier pricing mode {@link amount} was
     * drawn from (for example `MONTHLY-EFT`, `ANNUAL`). Always a key present
     * in {@link modes}.
     */
    readonly defaultMode: string;
    /** Full grid of carrier modes (`MONTHLY-EFT`, `ANNUAL`, ...). */
    readonly modes: Readonly<Record<string, V3Amount>>;
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
/**
 * One product's v3 offer, returned identically by `POST /v3/prequalify`
 * and `POST /v3/quote`. Array order of `pricing` is authoritative for
 * display — there is no `result_index`, no client-side sort key, no
 * synthetic rank.
 */
export interface V3Offer {
    readonly object: 'plan_offer';
    /**
     * UUID v5 identifying this product-at-a-requested-amount offer. In a
     * multi-amount response the same product appears once per amount, each
     * with a distinct id, so the id is NOT stable across amounts. To
     * compare a product across amounts, match on `carrier` + `product` slug.
     */
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
    /**
     * The coverage amount this offer provides, with `period: null` (a
     * one-time lump sum). Present (non-null) for life products
     * (fex/term/preneed); `null` for premium-only products (medsup), whose
     * coverage value lives entirely in `pricing[].premium`. Always present
     * on the wire as a key — `null` rather than omitted — so consumers
     * null-check it. On multi-amount face-amount requests this is the
     * grouping key — see {@link byAmount}.
     */
    readonly deathBenefit: V3Money | null;
    /**
     * The requested monthly budget this offer answers, with
     * `period: "monthly"`. Present only on monthly-budget quotes
     * (`undefined` on face-amount quotes). On multi-amount budget requests
     * this is the grouping key — see {@link byAmount}.
     */
    readonly budget?: V3Money;
    /**
     * One row per rate class for this product. Array order is
     * authoritative for display; exactly one row has `primary: true`
     * when the product has any qualifying class.
     */
    readonly pricing: readonly V3PricingRow[];
    readonly metadata: Readonly<Record<string, unknown>>;
}
/**
 * Payload of the `data` field on the v3 prequalify envelope.
 *
 * Always a flat `plans[]` array, whether the request carried one face
 * amount, a single monthly budget, or several amounts. Group client-side
 * by the requested dimension with {@link byAmount}: face-amount offers
 * key off `deathBenefit.amount.cents`; monthly-budget offers off
 * `budget.amount.cents`. The shape never changes with the amount count.
 */
export interface PrequalifyV3Result {
    readonly plans: readonly V3Offer[];
    /** Echoed envelope metadata. */
    readonly requestId: string;
    /** Echoed envelope metadata. */
    readonly idempotencyKey: string;
    readonly livemode: boolean;
    readonly retryAttempts: number;
}
/**
 * Group a flat `plans[]` array by the requested coverage dimension. When
 * any offer carries a `budget` (a monthly-budget response) the offers are
 * keyed off `budget.amount.cents`; otherwise off `deathBenefit.amount.cents`
 * (a face-amount response). Insertion order of first appearance is
 * preserved so callers can render a stable side-by-side table.
 *
 * In budget mode, an offer missing `budget` is skipped (contract violation)
 * rather than falling back to deathBenefit, which would mis-bucket mixed offers.
 * In face-amount mode, an offer with a `null` deathBenefit (a medsup product,
 * which has no face amount) is likewise skipped — it has no face-amount
 * dimension to group on.
 */
export declare function byAmount(plans: readonly V3Offer[]): ReadonlyMap<number, readonly V3Offer[]>;
/**
 * The premium facade for an offer — the {@link V3Premium} of the single
 * `primary` (best-qualifying) pricing row, or `null` when the offer has no
 * qualifying row (every row ineligible, or the rare eligible row whose
 * carrier returned no priceable mode). This is the one premium a list UI
 * shows per product without walking `pricing[]`.
 */
export declare function offerPremium(offer: V3Offer): V3Premium | null;
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
/** Payload of the `data` field on the v3 quote envelope. */
export interface QuoteV3Result {
    readonly plans: readonly V3Offer[];
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