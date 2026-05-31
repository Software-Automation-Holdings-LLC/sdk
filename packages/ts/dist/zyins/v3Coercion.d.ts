/** Shared v3 response coercion helpers for prequalify and quote parsing. */
import { isRecord } from './response.js';
import type { OfferCarrier, OfferProduct } from './prequalify-v2-types.js';
import type { V3Amount, V3Money } from './prequalify-v3-types.js';
export { isRecord };
export declare const toStr: (v: unknown) => string;
export declare const toNum: (v: unknown) => number;
export declare const toBool: (v: unknown) => boolean;
export declare const toNullableNum: (v: unknown) => number | null;
export declare function coerceCarrier(raw: unknown): OfferCarrier;
export declare function coerceProduct(raw: unknown): OfferProduct;
/** Coerce the leaf `{cents, display}` amount (OpenAPI `AmountResponse`). */
export declare function coerceAmount(raw: unknown): V3Amount;
/**
 * Coerce a `{amount: {cents, display}, period}` value (OpenAPI `Money`).
 * `period` falls back to `null` (a one-time lump sum) for any value outside
 * the closed enum, so an unknown future period never poisons the type.
 */
export declare function coerceMoney(raw: unknown): V3Money;
//# sourceMappingURL=v3Coercion.d.ts.map