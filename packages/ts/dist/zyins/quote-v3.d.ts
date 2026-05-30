/**
 * Tier 3 quote v3 operation — `POST /v3/quote`.
 *
 * Shares the uniform `pricing[]` table shape with v3 prequalify (see
 * `prequalify-v3-types.ts`). The quote endpoint groups qualifying
 * products by requested amount for side-by-side comparison tables.
 * Money is integer cents + display string; the v2 string-money map is
 * gone in v3.
 */
import type { QuoteV3Context, QuoteV3Request, QuoteV3Result } from './prequalify-v3-types';
export type { QuoteV3Context, QuoteV3Group, QuoteV3Options, QuoteV3Product, QuoteV3Request, QuoteV3Result, } from './prequalify-v3-types';
export declare function quoteV3(request: QuoteV3Request, ctx: QuoteV3Context): Promise<QuoteV3Result>;
//# sourceMappingURL=quote-v3.d.ts.map