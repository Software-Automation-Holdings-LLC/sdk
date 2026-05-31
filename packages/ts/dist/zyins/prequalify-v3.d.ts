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
import { type Applicant } from './applicant.js';
import { type CoverageInput } from './coverage.js';
import { type AuthContext } from './auth.js';
import { type Clock } from '../core/index.js';
import { type PrequalifyV3Context, type PrequalifyV3Request, type PrequalifyV3Result, type V3Offer, type V3PricingRow } from './prequalify-v3-types.js';
export { byAmount, offerPremium } from './prequalify-v3-types.js';
export type { PrequalifyV3Context, PrequalifyV3Options, PrequalifyV3Request, PrequalifyV3Result, QuoteV3Context, QuoteV3Options, QuoteV3Request, QuoteV3Result, V3Amount, V3Eligibility, V3EligibilityCategory, V3Money, V3Offer, V3Period, V3Premium, V3PricingRow, } from './prequalify-v3-types.js';
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
 * Coverage serialization is shape-driven (see {@link serializeV3Coverage}):
 * a single face amount sends `coverage.face_amount_cents`; a multi-amount
 * probe sends `coverage.quote_options`. The server (zyins #400) answers
 * the former with flat `plans` and the latter with grouped `results`.
 *
 * `applicant.state` and `applicant.zip` are moved into the coverage
 * envelope per the v3 schema (`zip` is required for medsup quotes; the
 * server zip-gates and silently filters medsup products when it is
 * absent). `options.minRank`, `options.showUnreleased`,
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
/**
 * Coerce one flat `plans[]` entry. Shared by `prequalifyV3` and `quoteV3`
 * — both endpoints return the identical {@link V3Offer} shape. `budget` is
 * present only on monthly-budget responses (`undefined` otherwise).
 */
export declare function coerceV3Offer(raw: unknown): V3Offer;
//# sourceMappingURL=prequalify-v3.d.ts.map