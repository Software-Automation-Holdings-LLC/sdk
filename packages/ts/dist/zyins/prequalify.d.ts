/**
 * Tier 3 prequalify operation.
 *
 * Builds the wire body, signs the request, calls `/v1/prequalify`, and
 * parses the response into one of two result shapes:
 *   - `SinglePrequalifyResult` — single coverage amount.
 *   - `MultiPrequalifyResult` — multiple amounts probed together.
 *
 * Locked invariants (per ADR-035, post-lock v0.5.3 spec):
 *  - The wire body is built by the SDK; the call site never sees it.
 *  - The idempotency key is derived from sessionId:op:body-hash.
 *  - Auth credentials live in HMAC headers only — never in the request body.
 *  - `products` accepts only typed wire tokens — regex semantics are gone.
 *  - Server response shape is `{ data: { meta, results: { <amount>: [...] } },
 *    request_id, idempotency_key }`.
 */
import { type Applicant } from './applicant.js';
import { type CoverageInput, type CoverageType } from './coverage.js';
import { type ProductSelection, type Product, type ProductClassValue } from './product.js';
import { type AuthContext } from './auth.js';
import { type Transport } from './transport.js';
import { type Clock } from '../core/index.js';
import type { OfferPlanInfo, OfferPlanInfoLegacy } from './prequalify-v2-types.js';
/** Optional per-call knobs that map onto the server's filter primitives. */
export interface PrequalifyOptions {
    /** Restrict to a single product class (server `only_product_class`). */
    onlyProductClass?: ProductClassValue;
    /** Include one or more product classes (server `include_product_class`). */
    includeProductClass?: readonly ProductClassValue[];
    /** Server-side `min_rank` filter (string per server contract). */
    minRank?: string;
    /** Include products flagged unreleased. */
    showUnreleased?: boolean;
    /** Skip the health-based underwriting layer (preview rates without HBU). */
    skipHealthBasedUnderwriting?: boolean;
}
/** Inputs accepted by `prequalify`. */
export interface PrequalifyRequest {
    applicant: Applicant;
    coverage: CoverageInput;
    products: ProductSelection;
    options?: PrequalifyOptions;
}
/**
 * One price the server quoted for a `(rate_class, mode)` pair.
 *
 * `cents` is the server display string parsed to integer minor units (e.g.
 * `"$64.05"` → `6405`). `display` is the server string verbatim — never
 * synthesized — so consumer UIs render exactly what the carrier intended,
 * including any commas, locale formatting, or "N/A" fallbacks.
 */
export interface PriceEntry {
    /** Integer minor units. `0` for unparseable / missing / "NA" / "0" prices. */
    cents: number;
    /** Server display string verbatim. `"N/A"` when the price was missing/unparseable. */
    display: string;
}
/**
 * Resolved pricing view for a `Plan`.
 *
 * The server emits `pricing[rate_class][mode] = "$XX.XX"` plus a sibling
 * `default_pricing_key` mode and `pricing_ranks` per rate class. Rate-class
 * and mode keys are CARRIER-SPECIFIC and emerge per carrier without notice;
 * the SDK preserves them verbatim — never lowercases, aliases, or remaps.
 *
 * Resolution rules (see `resolveDefaultPricing`):
 *  1. `rate_class` = `"default"` if present, else first key of `classes` in
 *     insertion order, else `"default"` (with empty classes/modes).
 *  2. `mode` = the server's `default_pricing_key` if it exists in the chosen
 *     class; else `"MONTHLY"` if present; else first key of `classes[rate_class]`
 *     in insertion order; else `""`.
 *  3. `cents`/`display` shortcut to `classes[rate_class][mode]` for the
 *     common "show me the headline price" path.
 *  4. `modes` is an alias to `classes[rate_class]` — same object reference,
 *     not a deep copy. Mutation is undefined behavior.
 */
export interface ResolvedPricing {
    /** Shortcut to `classes[rate_class][mode].cents`. */
    cents: number;
    /** Shortcut to `classes[rate_class][mode].display`. */
    display: string;
    /** Verbatim server mode key (e.g. `"MONTHLY"`, `"MONTHLY-EFT"`). */
    mode: string;
    /** Verbatim server rate-class key (e.g. `"default"`, `"super-preferred"`). */
    rate_class: string;
    /** Server's full per-class pricing table, with `cents` parsed per mode. */
    classes: Record<string, Record<string, PriceEntry>>;
    /** Alias view of `classes[rate_class]` — same reference, not a copy. */
    modes: Record<string, PriceEntry>;
}
/** One plan returned by the engine. */
export interface Plan {
    brand: string;
    name: string;
    plan: string;
    planGroup: string | null;
    deathBenefit: number;
    /** Resolved server pricing — see `ResolvedPricing`. */
    pricing: ResolvedPricing;
    /**
     * Server's per-rate-class rank values, verbatim. Keys mirror
     * `pricing.classes`. Numeric ranks pass through; nulls pass through.
     */
    pricingRanks: Record<string, number | null>;
    /** Verbatim server `default_pricing_key`; equals `pricing.mode` post-resolution. */
    defaultPricingKey: string;
    /** Server identifier — typically the product wire token. */
    id: string;
    index: number;
    isExcluded: boolean;
    logoUrl: string;
    /**
     * Array of `{key, label, values}` items in server-canonical display order.
     * Labels are Title Case; values are URL-decoded. Iterate the array
     * directly to render the plan info section.
     *
     * The wire body may carry either the typed array (post-zyins#349) or the
     * legacy `Record<string, string[]>` map; the SDK upconverts the latter so
     * downstream consumers see exactly one shape.
     */
    planInfo: OfferPlanInfo;
    /**
     * @deprecated Removed in next major. Use `planInfo` (typed array). This
     * field mirrors the legacy map shape during the migration window.
     */
    planInfoLegacy?: OfferPlanInfoLegacy;
    /** Hydrated typed catalog product when `id` matches a known wire token. */
    product?: Product;
    /** Forward-compatible raw fields the server emits but we don't yet model. */
    raw: Record<string, unknown>;
}
/** Backwards-compat alias — older call sites used `PrequalifyPlan`. */
export type PrequalifyPlan = Plan;
/** Aggregate meta from `data.meta`. */
export interface PrequalifyResultMeta {
    amounts: number[];
    processingTimeMs: number;
    quoteType: CoverageType;
    totalProducts: number;
}
/** Result shape for a single-amount prequalify call. */
export interface SinglePrequalifyResult {
    readonly kind: 'single';
    amount: number;
    plans: Plan[];
    meta: PrequalifyResultMeta;
    requestId: string;
    idempotencyKey: string;
    livemode: boolean;
    retryAttempts: number;
}
/** Result shape for a multi-amount prequalify call. */
export interface MultiPrequalifyResult {
    readonly kind: 'multi';
    amounts: number[];
    byAmount: Map<number, Plan[]>;
    /** Flattened convenience — every plan across every amount. */
    plans: Plan[];
    forAmount(n: number): Plan[];
    meta: PrequalifyResultMeta;
    requestId: string;
    idempotencyKey: string;
    livemode: boolean;
    retryAttempts: number;
}
/** Union returned by `prequalify`. */
export type PrequalifyResult = SinglePrequalifyResult | MultiPrequalifyResult;
/** Shared knobs the client passes through to the prequalify call. */
export interface PrequalifyContext {
    baseUrl: string;
    auth: AuthContext;
    transport: Transport;
    clock: Clock;
    /** Optional override; defaults to the derived key. */
    idempotencyKey?: string;
}
/**
 * Run a prequalify call. Builds the wire body, derives the idempotency key,
 * signs the request, and parses the response into typed plans.
 */
export declare function prequalify(request: PrequalifyRequest, ctx: PrequalifyContext): Promise<PrequalifyResult>;
//# sourceMappingURL=prequalify.d.ts.map