/**
 * Tier 3 applicant types for ZyINS prequalify.
 *
 * The wire format speaks in flat strings (sex code, integer inches, integer
 * pounds, ISO date) but Tier 3 callers speak in domain values (a `Sex` enum,
 * a `Height` constructed from feet+inches, a `Weight` constructed from
 * pounds). The factories in this module hide the bucket math; the client's
 * prequalify builder is the only consumer that knows how to serialize them.
 */

import type { State } from '../catalog/states';

/**
 * Applicant biological sex. The server accepts `male` and `female`
 * (canonical lowercase per ADR-012) and normalises legacy single-letter codes
 * (`M`, `F`) transparently. The SDK emits only the canonical form.
 */
export enum Sex {
  Male = 'male',
  Female = 'female',
}

/**
 * How long ago the applicant last used any nicotine product.
 * Values mirror the server's `NicotineLastUsed` enum exactly; the SDK
 * re-exports them under a friendlier name so callers never spell raw strings.
 */
export enum NicotineDuration {
  Never = 'never',
  Within12Months = 'within_12_months',
  N12To24Months = '12_to_24_months',
  N24To36Months = '24_to_36_months',
  N36To48Months = '36_to_48_months',
  N48To60Months = '48_to_60_months',
  Over60Months = 'over_60_months',
}

/**
 * Detailed usage record for a single nicotine product type.
 * Applicable only when {@link NicotineDuration.Within12Months} is selected.
 */
export interface NicotineProductUsage {
  /**
   * Product type. Valid values are returned by `GET /v1/datasets/nicotine_options`
   * (e.g., `CIGARETTE`, `CIGAR`, `PIPE`, `CHEWING TOBACCO`, `NICOTINE PATCH`,
   * `NICOTINE GUM`, `MEDICAL MARIJUANA`, `RECREATIONAL MARIJUANA`).
   */
  type: string;
  /**
   * How often the product is used. Valid values are returned by the same
   * nicotine options dataset.
   */
  frequency: string;
}

/**
 * Nicotine usage state the prequalify engine consumes.
 *
 * For never-users pass `{ lastUsed: NicotineDuration.Never }`.
 * For current users pass `{ lastUsed: NicotineDuration.Within12Months,
 * productUsage: [...] }`.
 */
export interface NicotineUsageInput {
  /** When nicotine was last used. */
  lastUsed: NicotineDuration;
  /**
   * Per-product detail. Required by the server only when
   * `lastUsed === NicotineDuration.Within12Months`; ignored otherwise.
   */
  productUsage?: ReadonlyArray<NicotineProductUsage>;
}

/**
 * @deprecated Use {@link NicotineUsageInput} with {@link NicotineDuration}.
 *
 * The old three-state enum (`None / Current / Former`) did not capture the
 * duration granularity the server requires. Existing callers can migrate by
 * replacing:
 *   - `NicotineUsage.None` → `{ lastUsed: NicotineDuration.Never }`
 *   - `NicotineUsage.Current` → `{ lastUsed: NicotineDuration.Within12Months }`
 *   - `NicotineUsage.Former` → `{ lastUsed: NicotineDuration.N12To24Months }`
 *     (or the appropriate duration bucket)
 */
export enum NicotineUsage {
  None = 'none',
  Current = 'current',
  Former = 'former',
}

/**
 * Total height for the applicant. Constructed via `Height.fromFeetInches`
 * so the call site never multiplies by 12 inline. Internally stored as a
 * total inch count to match the engine's normalized form.
 */
export class Height {
  private constructor(public readonly totalInches: number) {}

  /** Construct a height from a feet+inches pair (the natural US input). */
  static fromFeetInches(feet: number, inches: number): Height {
    if (!Number.isFinite(feet) || !Number.isFinite(inches)) {
      throw new Error('Height.fromFeetInches: feet and inches must be finite numbers');
    }
    if (feet < 0 || inches < 0) {
      throw new Error('Height.fromFeetInches: feet and inches must be non-negative');
    }
    return new Height(Math.round(feet * INCHES_PER_FOOT + inches));
  }

  /** Construct a height from a total inch count (rare; for parity tests). */
  static fromInches(totalInches: number): Height {
    if (!Number.isFinite(totalInches) || totalInches < 0) {
      throw new Error('Height.fromInches: totalInches must be a non-negative number');
    }
    return new Height(Math.round(totalInches));
  }
}

const INCHES_PER_FOOT = 12;

/**
 * Applicant weight in pounds (the only unit the prequalify wire accepts).
 * The factory exists so the call site reads `Weight.fromPounds(195)` rather
 * than passing a bare number which loses unit context.
 */
export class Weight {
  private constructor(public readonly pounds: number) {}

  /** Construct from a pound value (the natural US input). */
  static fromPounds(pounds: number): Weight {
    if (!Number.isFinite(pounds) || pounds <= 0) {
      throw new Error('Weight.fromPounds: pounds must be a positive number');
    }
    return new Weight(Math.round(pounds));
  }
}

/** A single medication on the applicant profile. */
export interface Medication {
  /** Drug name as the applicant reports it (e.g., "LOSARTAN"). */
  name: string;
  /** Reason for use (e.g., "HIGH BLOOD PRESSURE"). */
  use: string;
  /** Relative date string the prequalify engine accepts (e.g., "11 MONTHS AGO"). */
  firstFill: string;
  /** Most recent fill date in the same relative format. */
  lastFill: string;
}

/** A single medical condition on the applicant profile. */
export interface Condition {
  /** Condition name as the applicant reports it (e.g., "COPD", "HBP"). */
  name: string;
  /** Relative date string of diagnosis (e.g., "3 DAYS AGO"). */
  wasDiagnosed: string;
  /** Relative date string of most recent treatment. */
  lastTreatment: string;
}

/**
 * The applicant profile prequalify operates on. All fields are required for
 * a useful prequalify; the engine will refuse a request that omits any of
 * them, so they are non-optional at the type level.
 */
export interface Applicant {
  /** Date of birth as an ISO 8601 date string (e.g., "1962-04-18"). */
  dob: string;
  sex: Sex;
  height: Height;
  weight: Weight;
  /**
   * US state of residence (ISO 3166-2:US two-letter postal code).
   *
   * Pass the typed catalog enum to get autocomplete + typo protection:
   *
   * ```ts
   * import { State } from '@software-automation-holdings-llc/sdk';
   * const applicant: Applicant = { state: State.NorthCarolina, /* … *\/ };
   * ```
   *
   * Raw two-letter strings (`'NC'`) remain accepted for backward
   * compatibility; the typed form is idiotproof — typos like
   * `'North Carolina'` become compile errors.
   */
  state: State | (string & {});
  /** ZIP code; required by some product families. */
  zip?: string;
  /**
   * Nicotine usage state. Pass a {@link NicotineUsageInput} for the modern
   * API (full duration + product detail). The deprecated {@link NicotineUsage}
   * enum is still accepted at the type level for migration compatibility.
   */
  nicotineUse: NicotineUsageInput | NicotineUsage;
  /** Optional medications list; defaults to none. */
  medications?: ReadonlyArray<Medication>;
  /** Optional conditions list; defaults to none. */
  conditions?: ReadonlyArray<Condition>;
}
