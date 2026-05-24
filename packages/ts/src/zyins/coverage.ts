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
export enum QuoteType {
  FaceAmounts = 'face_amounts',
  MonthlyBudget = 'monthly_budget',
}

/** Internal — string-form of the type discriminator carried on every input. */
export type CoverageType = 'face_value' | 'monthly_budget';

/** Single coverage amount. */
export interface SingleCoverage {
  readonly type: CoverageType;
  readonly amount: number;
}

/** Multiple coverage amounts probed in one call. */
export interface MultiCoverage {
  readonly type: CoverageType;
  readonly amounts: readonly number[];
}

/** Coverage input accepted by `Isa.zyins.prequalify`. */
export type CoverageInput = SingleCoverage | MultiCoverage;

/** Backwards-compatibility alias — the type read by older call sites. */
export type Coverage = CoverageInput;
/** @deprecated retained for type-name compatibility. */
export type FaceValueCoverage = SingleCoverage & { type: 'face_value' };
/** @deprecated retained for type-name compatibility. */
export type MonthlyBudgetCoverage = SingleCoverage & { type: 'monthly_budget' };

/** Type guard for multi-amount coverage. */
export function isMulti(c: CoverageInput): c is MultiCoverage {
  return Array.isArray((c as MultiCoverage).amounts);
}

function ensurePositive(label: string, amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`${label}: amount must be a positive number`);
  }
  return Math.round(amount);
}

/** Static factories for Coverage. */
export const Coverage = {
  /** Single face-value coverage. */
  faceValue(amount: number): SingleCoverage {
    return { type: 'face_value', amount: ensurePositive('Coverage.faceValue', amount) };
  },

  /** Multiple face-value coverages probed in one call. */
  faceValues(amounts: readonly number[]): MultiCoverage {
    if (amounts.length === 0) {
      throw new Error('Coverage.faceValues: at least one amount required');
    }
    return {
      type: 'face_value',
      amounts: amounts.map((a) => ensurePositive('Coverage.faceValues', a)),
    };
  },

  /** Single monthly-budget coverage. */
  monthlyBudget(amount: number): SingleCoverage {
    return { type: 'monthly_budget', amount: ensurePositive('Coverage.monthlyBudget', amount) };
  },

  /** Multiple monthly-budget coverages probed in one call. */
  monthlyBudgets(amounts: readonly number[]): MultiCoverage {
    if (amounts.length === 0) {
      throw new Error('Coverage.monthlyBudgets: at least one amount required');
    }
    return {
      type: 'monthly_budget',
      amounts: amounts.map((a) => ensurePositive('Coverage.monthlyBudgets', a)),
    };
  },

  /** Type guard — true when the input is a face-value coverage. */
  isFaceValue(c: CoverageInput): c is SingleCoverage & { type: 'face_value' } {
    return c.type === 'face_value' && !isMulti(c);
  },

  /** Type guard — true when the input is a monthly-budget coverage. */
  isMonthlyBudget(
    c: CoverageInput,
  ): c is SingleCoverage & { type: 'monthly_budget' } {
    return c.type === 'monthly_budget' && !isMulti(c);
  },

  /** Type guard — true when the input is a multi-amount coverage. */
  isMulti,
} as const;
