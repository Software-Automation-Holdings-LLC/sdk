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

/**
 * Wire discriminator for the `quote_options.quote_type` field.
 * Values mirror the server's `QuoteType` enum exactly.
 */
export enum QuoteType {
  FaceAmounts = 'face_amounts',
  MonthlyBudget = 'monthly_budget',
}

/** Coverage requested by death benefit (face value in USD). */
export interface FaceValueCoverage {
  readonly type: 'face_value';
  /** The face value the applicant wants, in whole US dollars. */
  readonly amount: number;
}

/** Coverage requested by monthly budget (USD per month). */
export interface MonthlyBudgetCoverage {
  readonly type: 'monthly_budget';
  /** The monthly premium the applicant can afford, in whole US dollars. */
  readonly amount: number;
}

/**
 * Coverage union. Tier 3 callers construct via the static factories
 * `Coverage.faceValue` and `Coverage.monthlyBudget`; the discriminator is
 * managed by the SDK.
 */
export type Coverage = FaceValueCoverage | MonthlyBudgetCoverage;

/** Static-factory container for Coverage construction. */
export const Coverage = {
  /**
   * Coverage by face value (death benefit). The amount is rounded to a
   * whole dollar; sub-dollar inputs are an error.
   */
  faceValue(amount: number): FaceValueCoverage {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Coverage.faceValue: amount must be a positive number');
    }
    return { type: 'face_value', amount: Math.round(amount) };
  },

  /**
   * Coverage by monthly budget. The amount is rounded to a whole dollar;
   * sub-dollar inputs are an error.
   */
  monthlyBudget(amount: number): MonthlyBudgetCoverage {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Coverage.monthlyBudget: amount must be a positive number');
    }
    return { type: 'monthly_budget', amount: Math.round(amount) };
  },

  /** Type guard for face-value coverage. */
  isFaceValue(coverage: Coverage): coverage is FaceValueCoverage {
    return coverage.type === 'face_value';
  },

  /** Type guard for monthly-budget coverage. */
  isMonthlyBudget(coverage: Coverage): coverage is MonthlyBudgetCoverage {
    return coverage.type === 'monthly_budget';
  },
} as const;
