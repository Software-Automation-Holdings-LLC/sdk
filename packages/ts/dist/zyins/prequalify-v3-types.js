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
export function byAmount(plans) {
    const isBudgetResponse = plans.some((p) => p.budget !== undefined);
    const grouped = new Map();
    for (const offer of plans) {
        const dimension = isBudgetResponse
            ? (offer.budget ?? null)
            : offer.deathBenefit;
        // Budget mode: missing budget is a contract violation. Face-amount mode:
        // a null deathBenefit is a medsup product with no face-amount dimension.
        // Either way there is nothing to group on, so skip.
        if (dimension === null) {
            continue;
        }
        const key = dimension.amount.cents;
        const bucket = grouped.get(key);
        if (bucket === undefined) {
            grouped.set(key, [offer]);
        }
        else {
            bucket.push(offer);
        }
    }
    return grouped;
}
/**
 * The premium facade for an offer — the {@link V3Premium} of the single
 * `primary` (best-qualifying) pricing row, or `null` when the offer has no
 * qualifying row (every row ineligible, or the rare eligible row whose
 * carrier returned no priceable mode). This is the one premium a list UI
 * shows per product without walking `pricing[]`.
 */
export function offerPremium(offer) {
    const primary = offer.pricing.find((row) => row.primary);
    return primary?.premium ?? null;
}
//# sourceMappingURL=prequalify-v3-types.js.map