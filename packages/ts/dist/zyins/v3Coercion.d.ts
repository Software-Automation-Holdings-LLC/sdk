/** Shared v3 response coercion helpers for prequalify and quote parsing. */
import { isRecord } from './response';
import type { OfferCarrier, OfferProduct } from './prequalify-v2-types';
import type { V3Money } from './prequalify-v3-types';
export { isRecord };
export declare const toStr: (v: unknown) => string;
export declare const toNum: (v: unknown) => number;
export declare const toBool: (v: unknown) => boolean;
export declare const toNullableNum: (v: unknown) => number | null;
export declare function coerceCarrier(raw: unknown): OfferCarrier;
export declare function coerceProduct(raw: unknown): OfferProduct;
export declare function coerceMoney(raw: unknown): V3Money;
//# sourceMappingURL=v3Coercion.d.ts.map