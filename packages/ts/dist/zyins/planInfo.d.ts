import type { OfferPlanInfo, OfferPlanInfoLegacy } from './prequalify-v2-types';
type PlanInfoCoercion = {
    array: OfferPlanInfo;
    legacy?: OfferPlanInfoLegacy;
};
/**
 * Coerce either plan-info wire shape into the typed array surface plus a
 * legacy-map mirror.
 */
export declare function coercePlanInfo(raw: unknown): PlanInfoCoercion;
export {};
//# sourceMappingURL=planInfo.d.ts.map