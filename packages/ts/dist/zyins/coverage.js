/**
 * Tier 3 Coverage discriminated union.
 *
 * The prequalify wire format accepts either a face-value (dollar amount of
 * death benefit) or a monthly budget (dollar amount the applicant is willing
 * to pay per month). Each shape requires a different bucket-math step before
 * it hits the engine: face values are rounded to standard bands, monthly
 * budgets are converted to a premium ceiling.
 *
 * Tier 3 hides that math behind two factories:
 *
 *   Coverage.faceValue(100_000)
 *   Coverage.monthlyBudget(50)
 *
 * The call site never serializes "face_value" or chooses a bucket; the
 * prequalify builder reads the `type` discriminator and emits the right
 * wire fields. Per ADR-035's "invariants over options" doctrine, there is
 * no `options.preserveExactAmount` flag — the SDK locks in the right
 * bucketing.
 */
/** Static-factory container for Coverage construction. */
export const Coverage = {
    /**
     * Coverage by face value (death benefit). The amount is rounded to a
     * whole dollar; sub-dollar inputs are an error.
     */
    faceValue(amount) {
        if (!Number.isFinite(amount) || amount <= 0) {
            throw new Error('Coverage.faceValue: amount must be a positive number');
        }
        return { type: 'face_value', amount: Math.round(amount) };
    },
    /**
     * Coverage by monthly budget. The amount is rounded to a whole dollar;
     * sub-dollar inputs are an error.
     */
    monthlyBudget(amount) {
        if (!Number.isFinite(amount) || amount <= 0) {
            throw new Error('Coverage.monthlyBudget: amount must be a positive number');
        }
        return { type: 'monthly_budget', amount: Math.round(amount) };
    },
    /** Type guard for face-value coverage. */
    isFaceValue(coverage) {
        return coverage.type === 'face_value';
    },
    /** Type guard for monthly-budget coverage. */
    isMonthlyBudget(coverage) {
        return coverage.type === 'monthly_budget';
    },
};
//# sourceMappingURL=coverage.js.map