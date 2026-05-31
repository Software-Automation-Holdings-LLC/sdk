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
 */
export function byAmount(plans) {
    const isBudgetResponse = plans.some((p) => p.budget !== undefined);
    const grouped = new Map();
    for (const offer of plans) {
        let dimension;
        if (isBudgetResponse) {
            if (offer.budget === undefined) {
                // In budget mode, missing budget is a contract violation; skip.
                continue;
            }
            dimension = offer.budget;
        }
        else {
            dimension = offer.deathBenefit;
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
//# sourceMappingURL=prequalify-v3-types.js.map