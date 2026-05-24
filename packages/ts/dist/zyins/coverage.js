/**
 * Coverage — single or multi-amount, face-value or monthly budget.
 *
 * The locked design lets one prequalify call probe several coverage amounts
 * at once: face values (death benefits) or monthly budgets (premium
 * ceilings). The wire shape is uniform: `quote_options.amounts: string[]`
 * with `quote_type` set to one of `face_amounts` / `monthly_budget`.
 *
 * Call sites:
 *
 *   Coverage.faceValue(100_000)           // single
 *   Coverage.faceValues([15_000, 25_000])  // multi
 *   Coverage.monthlyBudget(50)             // single
 *   Coverage.monthlyBudgets([50, 75, 100]) // multi
 *
 * The SDK selects the result envelope shape (`SinglePrequalifyResult` vs
 * `MultiPrequalifyResult`) from the input discriminator — no caller flags.
 */
/** Wire discriminator for `quote_options.quote_type`. */
export var QuoteType;
(function (QuoteType) {
    QuoteType["FaceAmounts"] = "face_amounts";
    QuoteType["MonthlyBudget"] = "monthly_budget";
})(QuoteType || (QuoteType = {}));
/** Type guard for multi-amount coverage. */
export function isMulti(c) {
    return Array.isArray(c.amounts);
}
function ensurePositive(label, amount) {
    if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error(`${label}: amount must be a positive number`);
    }
    return Math.round(amount);
}
/** Static factories for Coverage. */
export const Coverage = {
    /** Single face-value coverage. */
    faceValue(amount) {
        return { type: 'face_value', amount: ensurePositive('Coverage.faceValue', amount) };
    },
    /** Multiple face-value coverages probed in one call. */
    faceValues(amounts) {
        if (amounts.length === 0) {
            throw new Error('Coverage.faceValues: at least one amount required');
        }
        return {
            type: 'face_value',
            amounts: amounts.map((a) => ensurePositive('Coverage.faceValues', a)),
        };
    },
    /** Single monthly-budget coverage. */
    monthlyBudget(amount) {
        return { type: 'monthly_budget', amount: ensurePositive('Coverage.monthlyBudget', amount) };
    },
    /** Multiple monthly-budget coverages probed in one call. */
    monthlyBudgets(amounts) {
        if (amounts.length === 0) {
            throw new Error('Coverage.monthlyBudgets: at least one amount required');
        }
        return {
            type: 'monthly_budget',
            amounts: amounts.map((a) => ensurePositive('Coverage.monthlyBudgets', a)),
        };
    },
    /** Type guard — true when the input is a face-value coverage. */
    isFaceValue(c) {
        return c.type === 'face_value' && !isMulti(c);
    },
    /** Type guard — true when the input is a monthly-budget coverage. */
    isMonthlyBudget(c) {
        return c.type === 'monthly_budget' && !isMulti(c);
    },
    /** Type guard — true when the input is a multi-amount coverage. */
    isMulti,
};
//# sourceMappingURL=coverage.js.map