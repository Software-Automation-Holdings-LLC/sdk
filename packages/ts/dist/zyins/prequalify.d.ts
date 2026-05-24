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
import { type Applicant } from './applicant';
import { type CoverageInput, type CoverageType } from './coverage';
import { type ProductSelection, type Product, type ProductTypeValue } from './product';
import { type AuthContext } from './auth';
import { type Transport } from './transport';
import { type Clock } from '../core';
/** Optional per-call knobs that map onto the server's filter primitives. */
export interface PrequalifyOptions {
    /** Restrict to a single product class (server `only_product_class`). */
    onlyProductClass?: ProductTypeValue;
    /** Include one or more product classes (server `include_product_class`). */
    includeProductClass?: readonly ProductTypeValue[];
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
/** One plan returned by the engine. */
export interface Plan {
    brand: string;
    name: string;
    plan: string;
    planGroup: string | null;
    deathBenefit: number;
    monthlyPrice: number | undefined;
    defaultPricingKey: string;
    /** Server identifier — typically the product wire token. */
    id: string;
    index: number;
    isExcluded: boolean;
    logoUrl: string;
    planInfo: Record<string, readonly string[]>;
    pricing: Record<string, {
        monthly: number;
        [k: string]: unknown;
    }>;
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