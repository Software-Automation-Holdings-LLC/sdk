/**
 * Tier 3 quote v3 operation — `POST /v3/quote`.
 *
 * Shares the uniform `pricing[]` table and the flat `plans[]` envelope
 * with v3 prequalify (see `prequalify-v3-types.ts`). Both endpoints answer
 * one flat array; group client-side by the requested dimension with
 * {@link byAmount} (deathBenefit for face amounts, budget for monthly
 * budgets). Money is the {cents, display} amount paired with a recurrence
 * period; the v2 string-money map is gone in v3.
 */
import type { QuoteV3Context, QuoteV3Request, QuoteV3Result } from './prequalify-v3-types.js';
export { byAmount } from './prequalify-v3-types.js';
export type { QuoteV3Context, QuoteV3Options, QuoteV3Request, QuoteV3Result, V3Offer, } from './prequalify-v3-types.js';
export declare function quoteV3(request: QuoteV3Request, ctx: QuoteV3Context): Promise<QuoteV3Result>;
//# sourceMappingURL=quote-v3.d.ts.map