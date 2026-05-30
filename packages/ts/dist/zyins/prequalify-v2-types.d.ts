/**
 * Typed value objects for `POST /v2/prequalify`. See `prequalify-v2.ts`
 * for the operation entry point. These shapes mirror the OpenAPI schemas
 * (`PlanOffer`, `OtherOffer`, `OfferPremium`, ...) so consumers reading
 * the public spec see the same names verbatim.
 *
 * Field-name policy:
 *  - Wire-shape value objects preserve server snake_case (`rate_class`,
 *    `other_offers`, `coverage_tier`, ...) — these are the OpenAPI fields.
 *  - Top-level envelope metadata follows the `Envelope<T>` camelCase
 *    convention (`requestId`, `idempotencyKey`).
 */
import { type Applicant } from './applicant';
import { type CoverageInput } from './coverage';
import { type ProductSelection, type ProductClassValue } from './product';
import { type AuthContext } from './auth';
import { type Transport } from './transport';
import { type Clock } from '../core';
/** Eligibility category — closed enum on qualifying offers, `null` otherwise. */
export type OfferCategory = 'immediate' | 'graded' | 'rop' | null;
/** Qualifies-or-not view for a single offer / tier. */
export interface OfferEligibility {
    /** True when the applicant qualifies at this category. */
    eligible: boolean;
    /** Closed enum of underwriting categories; `null` on ineligible offers. */
    category: OfferCategory;
    /** Carrier rate-class string verbatim (e.g. `"Preferred Plus"`); `null` when not segmented. */
    coverage_tier: string | null;
    /** Human-readable reasons — populated only when `eligible` is false. */
    reasons: readonly string[];
}
/** The carrier underwriting an offer. */
export interface OfferCarrier {
    /** Stable opaque carrier id (UUID). */
    id: string;
    /** Display name for agent-facing UIs. */
    name: string;
    /** Absolute logo URL (PNG). */
    logo_url: string;
}
/** The carrier product an offer represents. */
export interface OfferProduct {
    /** Stable opaque product id (UUID). */
    id: string;
    /** Human-readable, URL-safe stable identifier. */
    slug: string;
    /** Carrier-supplied product name. */
    name: string;
    /** Fully qualified display name (carrier + product). */
    display_name: string;
    /** Canonical product family — `fex`, `term`, `medsup`, `preneed`, `annuity`, ... */
    type: string;
    /** Wire token for the product family — equals `type` today. */
    wire_token: string;
}
/**
 * One server-canonical entry in {@link OfferPlanInfo}.
 *
 * `key` is the stable wire identifier (snake_case); `label` is the
 * Title Case display string the server emits; `values` are the URL-decoded
 * value strings in server-canonical order.
 */
export interface OfferPlanInfoItem {
    /** Stable wire key (e.g. `eapp`, `telesales`, `rate_class_notes`). */
    key: string;
    /** Title Case display label, server-emitted (e.g. `eApp`, `Telesales`). */
    label: string;
    /** URL-decoded values for this key, in server-canonical display order. */
    values: readonly string[];
}
/**
 * Server-canonical, ordered, typed plan-info surface. Iterate the array
 * directly to render the plan info section — labels are Title Case and
 * values are URL-decoded.
 *
 * The wire shape is `Array<{key, label, values}>` post-zyins#349. The SDK
 * upconverts a legacy `Record<string, string[]>` body to this shape so
 * downstream consumers see exactly one type during the migration window.
 */
export type OfferPlanInfo = readonly OfferPlanInfoItem[];
/**
 * @deprecated Removed in next major. Use `plan_info` (typed array). This
 * field mirrors the legacy map shape during the migration window.
 */
export type OfferPlanInfoLegacy = Record<string, readonly string[]>;
/** A money value denominated in integer minor units. */
export interface OfferMoney {
    /** Integer minor units (US cents). */
    cents: number;
    /** Server-formatted display string — render verbatim. */
    display: string;
}
/** Death benefit alias for `OfferMoney`. */
export type OfferDeathBenefit = OfferMoney;
/** Premium for an offer at a resolved (rate_class, mode), with full mode grid. */
export interface OfferPremium {
    /** Premium for the default mode and rate class, in minor units. */
    cents: number;
    /** Server-formatted display string for the default mode. */
    display: string;
    /** Carrier-defined default pricing mode verbatim. */
    mode: string;
    /** Carrier-defined rate class for this offer verbatim. */
    rate_class: string;
    /** Full grid of carrier-supported pricing modes for this rate class. */
    modes: Record<string, OfferMoney>;
}
/**
 * Sparse alternate-tier view nested in `PlanOffer.other_offers[]`. Carries
 * only the fields that differ from the parent best-offer entry.
 */
export interface OtherOffer {
    /** Server-assigned rank for this alternate; `null` when ineligible. */
    rank: number | null;
    /** Eligibility for this alternate category. */
    eligibility: OfferEligibility;
    /** Premium for this alternate; `null` when ineligible. */
    premium: OfferPremium | null;
}
/** One best-offer-per-product entry in the v2 result. */
export interface PlanOffer {
    /** Discriminator — always `"plan_offer"`. */
    object: 'plan_offer';
    /** Stable v5-derived UUID for `(carrier_slug, product_slug)`. */
    id: string;
    /** Zero-based engine ordering index — UI should sort by `rank` instead. */
    result_index: number;
    /** Best qualifying rank for this product; `null` when ineligible. */
    rank: number | null;
    /** Eligibility for the best qualifying category. */
    eligibility: OfferEligibility;
    /** Carrier underwriting this offer. */
    carrier: OfferCarrier;
    /** Product this offer represents. */
    product: OfferProduct;
    /**
     * Array of `{key, label, values}` items in server-canonical display order.
     * Labels are Title Case; values are URL-decoded. Iterate the array
     * directly to render the plan info section.
     */
    plan_info: OfferPlanInfo;
    /**
     * @deprecated Removed in next major. Use `plan_info` (typed array). This
     * field mirrors the legacy map shape during the migration window.
     */
    plan_info_legacy?: OfferPlanInfoLegacy;
    /** Death benefit for this offer. */
    death_benefit: OfferDeathBenefit;
    /** Premium for the best qualifying category; `null` when ineligible. */
    premium: OfferPremium | null;
    /** Alternate eligibility categories for the same product. */
    other_offers: readonly OtherOffer[];
    /** Account-scoped key/value bag echoed from the request, or `{}`. */
    metadata: Record<string, unknown>;
}
/** v2-only knobs layered on top of v1 prequalify options. */
export interface PrequalifyV2Options {
    /** Restrict to a single product class (server `only_product_class`). */
    onlyProductClass?: ProductClassValue;
    /** Include one or more product classes (server `include_product_class`). */
    includeProductClass?: readonly ProductClassValue[];
    /** Server-side `min_rank` filter (string per server contract). */
    minRank?: string;
    /** Include products flagged unreleased. */
    showUnreleased?: boolean;
    /** Skip the health-based underwriting layer. */
    skipHealthBasedUnderwriting?: boolean;
    /** When true, surfaces declined products and declined alternates. Default false. */
    includeIneligible?: boolean;
}
/** Inputs accepted by `prequalifyV2`. */
export interface PrequalifyV2Request {
    applicant: Applicant;
    coverage: CoverageInput;
    products: ProductSelection;
    options?: PrequalifyV2Options;
}
/** Typed payload of the v2 `data` field plus echoed envelope metadata. */
export interface PrequalifyV2Result {
    /** One entry per product, sorted best-rank-first. */
    plans: readonly PlanOffer[];
    /** Pagination scaffolding — always `false` today. */
    has_more: boolean;
    /** Opaque next-page cursor; `null` when `has_more` is false. */
    next_cursor: string | null;
    /** Echoed envelope metadata. */
    requestId: string;
    /** Echoed envelope metadata. */
    idempotencyKey: string;
    /** Whether the response was produced against live data. */
    livemode: boolean;
    /** Number of SDK retry attempts before this call succeeded. */
    retryAttempts: number;
}
/** Per-call context for the v2 prequalify operation. */
export interface PrequalifyV2Context {
    baseUrl: string;
    auth: AuthContext;
    transport: Transport;
    clock: Clock;
    /** Optional override; defaults to the derived key. */
    idempotencyKey?: string;
}
//# sourceMappingURL=prequalify-v2-types.d.ts.map